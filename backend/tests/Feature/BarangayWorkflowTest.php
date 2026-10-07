<?php

namespace Tests\Feature;

use App\Models\WaterEconomyBarangay;
use App\Models\WaterEconomyProject;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class BarangayWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private function barangay(): WaterEconomyBarangay
    {
        return WaterEconomyBarangay::create([
            'psgc_code' => '123456789', 'lgu' => 'Test City', 'barangay' => 'Test Barangay',
            'gross_supply_m3_day' => 100, 'source_capacity_m3_day' => 100,
            'nrw_rate_pct' => 30, 'reserve_rate_pct' => 0,
            'household_demand_m3_day' => 120, 'critical_services_demand_m3_day' => 0,
        ]);
    }

    public function test_scenario_preview_recalculates_without_persisting_draft_values(): void
    {
        $barangay = $this->barangay();

        $response = $this->postJson('/api/water-economy/scenario-preview/123456789', [
            'changes' => ['nrw_rate_pct' => 20, 'gross_supply_m3_day' => 150, 'source_capacity_m3_day' => 150],
        ])->assertOk()->assertJsonPath('saved', false);

        $this->assertLessThan($response->json('before.deficit_m3_day'), $response->json('after.deficit_m3_day'));
        $this->assertLessThan($response->json('before.source_pressure_pct'), $response->json('after.source_pressure_pct'));
        $this->assertDatabaseHas('water_economy_barangays', [
            'id' => $barangay->id, 'nrw_rate_pct' => 30, 'gross_supply_m3_day' => 100,
        ]);
    }

    public function test_scenario_preview_rejects_invalid_assumptions(): void
    {
        $this->barangay();
        $this->postJson('/api/water-economy/scenario-preview/123456789', [
            'changes' => ['nrw_rate_pct' => 101],
        ])->assertUnprocessable();
    }

    public function test_intervention_ranking_preview_includes_saved_and_draft_projects_without_saving_drafts(): void
    {
        $this->barangay();
        WaterEconomyProject::create([
            'psgc_code' => '123456789', 'project_type' => 'Existing', 'name' => 'Saved Project',
            'capex_php' => 100000, 'annual_opex_php' => 1000, 'useful_life_years' => 10,
            'water_gain_m3_per_day' => 10, 'households_benefited' => 100,
            'reliability_score' => 70, 'equity_score' => 70, 'economic_benefit_score' => 70,
            'implementation_time_months' => 12,
        ]);
        $draft = [
            'project_type' => 'NRW Reduction Program', 'name' => 'Draft NRW',
            'capex_php' => 50000, 'annual_opex_php' => 500, 'useful_life_years' => 12,
            'water_gain_m3_per_day' => 20, 'households_benefited' => 120,
            'reliability_score' => 75, 'equity_score' => 80, 'economic_benefit_score' => 70,
            'implementation_time_months' => 8,
        ];

        $this->postJson('/api/water-economy/benefit-per-peso/123456789/preview', [
            'projects' => [$draft],
        ])->assertOk()->assertJsonPath('saved', false)
            ->assertJsonFragment(['name' => 'Saved Project'])
            ->assertJsonFragment(['name' => 'Draft NRW']);

        $this->assertDatabaseCount('water_economy_projects', 1);
    }

    public function test_ai_receives_backend_calculated_workflow_context(): void
    {
        $this->barangay();
        Http::fake(['https://api.groq.com/*' => Http::response([
            'choices' => [['message' => ['content' => json_encode([
                'message' => 'Higher supply removes the modeled deficit.',
                'suggested_scenario' => null,
            ])]]],
        ], 200)]);

        $this->postJson('/api/ai/decision-chat', [
            'message' => 'Explain the result.',
            'psgc_code' => '123456789',
            'workflow_context' => [
                'changes' => ['nrw_rate_pct' => 20, 'gross_supply_m3_day' => 150, 'source_capacity_m3_day' => 150],
                'projects' => [],
            ],
        ])->assertOk()->assertJsonPath('reply', 'Higher supply removes the modeled deficit.');

        Http::assertSent(function ($request) {
            $content = collect($request['messages'])->last()['content'] ?? '';
            return str_contains($content, 'workflow_results')
                && str_contains($content, 'source_pressure_pct')
                && str_contains($content, '"deficit_m3_day":0');
        });
    }

    public function test_explicit_nrw_save_persists_both_required_inputs(): void
    {
        $barangay = $this->barangay();
        $this->putJson('/api/water-economy/nrw/123456789', [
            'allocable_water_m3_day' => 140,
            'proposed_nrw_rate_pct' => 20,
        ])->assertOk();

        $this->assertDatabaseHas('water_economy_barangays', [
            'id' => $barangay->id,
            'allocable_water_m3_day' => 140,
            'proposed_nrw_rate_pct' => 20,
        ]);
    }

    public function test_decision_snapshot_ai_action_runs_after_calculation(): void
    {
        $this->barangay();
        Http::fake(['https://api.groq.com/*' => Http::response([
            'choices' => [['message' => ['content' => json_encode([
                'headline' => 'Supply matches modeled demand.',
                'why' => ['Usable water and demand are equal.'],
                'tradeoff' => 'No reserve margin remains.',
                'confidence' => 'SIMULATED',
            ])]]],
        ], 200)]);

        $this->postJson('/api/water-economy/decision-snapshot/123456789/ai')
            ->assertOk()
            ->assertJsonPath('ai.headline', 'Supply matches modeled demand.');
    }
}
