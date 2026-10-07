<?php

namespace Tests\Feature;

use App\Models\WaterEconomyBarangay;
use App\Models\WaterEconomyProject;
use App\Services\DaloyDecisionContextService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
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

    public function test_ai_receives_population_for_selected_barangay_and_other_lgus(): void
    {
        $barangay = $this->barangay();
        $barangay->update(['population_2024' => 1200, 'avg_household_size' => 4]);
        $other = $barangay->replicate();
        $other->fill([
            'psgc_code' => '987654321', 'lgu' => 'Other City',
            'barangay' => 'Other Barangay', 'population_2024' => 300,
            'data_status' => ['population_2024' => 'ACTUAL / PSA-backed'],
        ])->save();

        Http::fake(['https://api.groq.com/*' => Http::response([
            'choices' => [['message' => ['content' => 'Other Barangay has a recorded 2024 population of 300.']]],
        ])]);

        $this->postJson('/api/ai/decision-chat', [
            'message' => 'What is the population of Other Barangay?',
            'psgc_code' => $barangay->psgc_code,
        ])->assertOk();

        Http::assertSent(function ($request): bool {
            $content = collect($request['messages'])->last()['content'];
            $json = explode("\n\nUSER QUESTION:", substr($content, strlen("STRUCTURED CONTEXT:\n")))[0];
            $context = json_decode($json, true, 512, JSON_THROW_ON_ERROR);

            return $context['selected_context']['population']['population_2024'] === 1200
                && $context['population_context']['year'] === 2024
                && collect($context['population_context']['lgu_totals'])->firstWhere('lgu', 'Other City')['recorded_population'] === 300
                && collect($context['population_context']['barangays'])->firstWhere('psgc_code', '987654321')['data_status'] === 'ACTUAL / PSA-backed';
        });
    }

    public function test_ai_receives_population_without_selection_and_explicit_watershed_data_limits(): void
    {
        $barangay = $this->barangay();
        $barangay->update(['population_2024' => 1200]);
        Http::fake(['https://api.groq.com/*' => Http::response([
            'choices' => [['message' => ['content' => 'A watershed drains rainfall toward a common outlet.']]],
        ])]);

        $this->postJson('/api/ai/decision-chat', [
            'message' => 'How does population affect a watershed?',
        ])->assertOk();

        Http::assertSent(function ($request): bool {
            $system = $request['messages'][0]['content'];
            $content = collect($request['messages'])->last()['content'];
            $json = explode("\n\nUSER QUESTION:", substr($content, strlen("STRUCTURED CONTEXT:\n")))[0];
            $context = json_decode($json, true, 512, JSON_THROW_ON_ERROR);

            return $context['selected_context'] === null
                && $context['population_context']['lgu_totals'][0]['recorded_population'] === 1200
                && $context['watershed_context']['local_records_available'] === false
                && str_contains($system, 'You may explain general watershed concepts')
                && str_contains($system, 'Do not infer a watershed');
        });
    }

    public function test_population_context_stays_compact_with_a_full_barangay_dataset(): void
    {
        $barangay = $this->barangay();
        $barangay->update(['population_2024' => 1200]);
        for ($index = 0; $index < 237; $index++) {
            $row = $barangay->replicate();
            $row->fill([
                'psgc_code' => 'fixture-'.$index,
                'barangay' => 'Fixture Barangay '.$index,
                'population_2024' => 1000 + $index,
            ])->save();
        }

        $context = app(DaloyDecisionContextService::class)
            ->populationContext('What is the population of Fixture Barangay 100?', $barangay->psgc_code);

        $this->assertCount(238, WaterEconomyBarangay::all());
        $this->assertLessThanOrEqual(15, count($context['barangays']));
        $this->assertLessThan(5000, strlen(json_encode($context)));
        $this->assertSame(238, $context['lgu_totals'][0]['barangay_count']);
        $this->assertSame(1100, collect($context['barangays'])->firstWhere('psgc_code', 'fixture-100')['population_2024']);
        $this->assertNotNull(collect($context['barangays'])->firstWhere('psgc_code', $barangay->psgc_code));
    }

    public function test_short_conversational_messages_do_not_call_the_rate_limited_provider(): void
    {
        Http::fake(['https://api.groq.com/*' => Http::response([], 429)]);

        foreach (['k', 'K!', 'okay', 'hehe', 'hello', 'thanks'] as $message) {
            $response = $this->postJson('/api/ai/decision-chat', ['message' => $message])
                ->assertOk()->assertJsonPath('suggested_scenario', null);

            $this->assertNotEmpty($response->json('reply'));
            $this->assertStringNotContainsString('Unable to contact', $response->json('reply'));
        }

        Http::assertNothingSent();
    }

    public function test_ai_rate_limit_returns_a_clear_temporary_error(): void
    {
        Http::fake(['https://api.groq.com/*' => Http::response([
            'error' => ['message' => 'Rate limit reached'],
        ], 429)]);

        $this->postJson('/api/ai/decision-chat', ['message' => 'What is the population of Catbalogan?'])
            ->assertStatus(429)
            ->assertJsonPath('message', 'The AI is busy right now. Please wait a moment and try again.')
            ->assertJsonMissingPath('reply');
    }

    public function test_ai_connection_failure_returns_a_useful_temporary_error(): void
    {
        Http::fake(function () {
            throw new ConnectionException('Could not connect');
        });

        $this->postJson('/api/ai/decision-chat', ['message' => 'What is a watershed?'])
            ->assertStatus(503)
            ->assertJsonPath('message', 'The AI service is temporarily unavailable. Please try again shortly.');
    }

    public function test_ai_missing_answer_asks_for_clarification(): void
    {
        Http::fake(['https://api.groq.com/*' => Http::response([
            'choices' => [['message' => ['content' => '{}']]],
        ])]);

        $this->postJson('/api/ai/decision-chat', ['message' => 'Explain that'])
            ->assertOk()
            ->assertJsonPath('reply', 'I could not find a clear answer. Could you rephrase your question or include the barangay or LGU name?')
            ->assertJsonPath('suggested_scenario', null);
    }

    public function test_empty_ai_response_is_not_presented_as_a_connection_failure(): void
    {
        Http::fake(['https://api.groq.com/*' => Http::response([
            'choices' => [['message' => ['content' => '']]],
        ])]);

        $this->postJson('/api/ai/decision-chat', ['message' => 'Explain that'])
            ->assertStatus(502)
            ->assertJsonPath('message', 'The AI did not return an answer. Please try again or rephrase your question.');
    }

    public function test_short_domain_questions_still_reach_the_ai(): void
    {
        Http::fake(['https://api.groq.com/*' => Http::response([
            'choices' => [['message' => ['content' => '{"message":"NRW means non-revenue water."}']]],
        ])]);

        $this->postJson('/api/ai/decision-chat', ['message' => 'NRW?'])
            ->assertOk()->assertJsonPath('reply', 'NRW means non-revenue water.');
        Http::assertSentCount(1);
    }

    public function test_missing_database_information_returns_a_normal_reply_without_scenarios(): void
    {
        $this->barangay();
        $reply = 'I do not have school enrollment figures in the available project data. I can help with recorded population instead.';
        Http::fake(['https://api.groq.com/*' => Http::response([
            'choices' => [['message' => ['content' => json_encode([
                'answer_status' => 'missing_data',
                'message' => $reply,
                'suggested_option' => 'Change water supply',
                'suggested_scenario' => ['label' => 'Unrelated change', 'changes' => ['nrw_rate_pct' => 20]],
            ])]]],
        ])]);

        $this->postJson('/api/ai/decision-chat', [
            'message' => 'How many students enrolled in public schools last year?',
            'psgc_code' => '123456789',
        ])->assertOk()->assertJsonPath('reply', $reply)
            ->assertJsonPath('answer_status', 'missing_data')
            ->assertJsonPath('recommendation', null)
            ->assertJsonPath('suggested_scenario', null);

        Http::assertSent(fn ($request): bool => str_contains(
            $request['messages'][0]['content'],
            'applies to every topic, not just population or watersheds'
        ));
    }

    public function test_unknown_selected_barangay_returns_a_missing_data_reply_without_calling_ai(): void
    {
        Http::fake();

        $this->postJson('/api/ai/decision-chat', [
            'message' => 'What is the population here?',
            'psgc_code' => 'not-in-database',
        ])->assertOk()
            ->assertJsonPath('answer_status', 'missing_data')
            ->assertJsonPath('reply', 'I do not have a record for that barangay in the available project data. Try another barangay or ask a general question about water or watersheds.')
            ->assertJsonPath('suggested_scenario', null);

        Http::assertNothingSent();
    }

    public function test_missing_data_or_out_of_scope_without_model_text_gets_a_useful_reply(): void
    {
        $status = '';
        Http::fake(function () use (&$status) {
            return Http::response([
                'choices' => [['message' => ['content' => json_encode(['answer_status' => $status])]]],
            ]);
        });

        foreach (['missing_data', 'out_of_scope'] as $status) {
            $response = $this->postJson('/api/ai/decision-chat', ['message' => 'What information do you have?'])
                ->assertOk()->assertJsonPath('answer_status', $status)
                ->assertJsonPath('suggested_scenario', null);

            $this->assertNotEmpty($response->json('reply'));
            $this->assertStringNotContainsString('Unable to contact', $response->json('reply'));
        }
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
