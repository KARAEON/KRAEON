<?php

namespace App\Services;

use App\Models\WaterEconomyProject;

class PublicBenefitPerPesoService
{
    public const DEFAULT_WEIGHTS = [
        'water' => 30,
        'equity' => 25,
        'economic' => 20,
        'reliability' => 15,
        'cost_efficiency' => 10,
    ];

    public function rank(
        iterable $projects,
        InterventionValuationService $valuationService,
        array $weights = self::DEFAULT_WEIGHTS
    ): array {
        $weights = $this->normalizeWeights($weights);

        $rows = [];

        foreach ($projects as $project) {
            $valuation = $valuationService->valueProject($project);

            $rows[] = [
                'project' => $project,
                'valuation' => $valuation,
                'water_gain' => max(
                    0,
                    (float) $project->water_gain_m3_per_day
                ),
                'cost_per_m3' => data_get(
                    $valuation,
                    'valuation.simple_lifecycle_cost_per_m3_php'
                ),
            ];
        }

        if (count($rows) === 0) {
            return [
                'weights' => $weights,
                'weight_label' => 'CUSTOM POLICY WEIGHTS',
                'ranking' => [],
            ];
        }

        $maxWaterGain = max(
            array_map(
                fn ($row) => $row['water_gain'],
                $rows
            )
        );

        $validCosts = array_values(
            array_filter(
                array_map(
                    fn ($row) => $row['cost_per_m3'],
                    $rows
                ),
                fn ($value) =>
                    $value !== null &&
                    (float) $value > 0
            )
        );

        $minCost = count($validCosts)
            ? min(array_map('floatval', $validCosts))
            : null;

        $ranking = [];

        foreach ($rows as $row) {
            /** @var WaterEconomyProject $project */
            $project = $row['project'];

            /*
            |--------------------------------------------------------------------------
            | NORMALIZED 0–100 SUBSCORES
            |--------------------------------------------------------------------------
            |
            | Water Benefit:
            | project water gain / highest water gain × 100
            |
            | Equity, economic/livelihood, reliability:
            | already stored as 0–100 project scores.
            |
            | Cost Efficiency:
            | lowest cost/m3 / project cost/m3 × 100
            | so LOWER project cost/m3 gets a HIGHER score.
            |
            */

            $waterScore = $maxWaterGain > 0
                ? ($row['water_gain'] / $maxWaterGain) * 100
                : 0;

            $equityScore = $this->clampScore(
                $project->equity_score
            );

            $economicScore = $this->clampScore(
                $project->economic_benefit_score
            );

            $reliabilityScore = $this->clampScore(
                $project->reliability_score
            );

            $costPerM3 = $row['cost_per_m3'];

            $costEfficiencyScore =
                $minCost !== null &&
                $costPerM3 !== null &&
                (float) $costPerM3 > 0
                    ? min(
                        100,
                        ($minCost / (float) $costPerM3) * 100
                    )
                    : 0;

            $score =
                ($waterScore * ($weights['water'] / 100)) +
                ($equityScore * ($weights['equity'] / 100)) +
                ($economicScore * ($weights['economic'] / 100)) +
                ($reliabilityScore * ($weights['reliability'] / 100)) +
                ($costEfficiencyScore * ($weights['cost_efficiency'] / 100));

            $ranking[] = [
                'project_id' => $project->id,
                'project_type' => $project->project_type,
                'name' => $project->name,

                'public_benefit_score' =>
                    round($score, 2),

                'subscores' => [
                    'water_benefit' =>
                        round($waterScore, 2),

                    'equity' =>
                        round($equityScore, 2),

                    'economic_livelihood' =>
                        round($economicScore, 2),

                    'reliability' =>
                        round($reliabilityScore, 2),

                    'cost_efficiency' =>
                        round($costEfficiencyScore, 2),
                ],

                'economics' => [
                    'simple_lifecycle_cost_per_m3_php' =>
                        $costPerM3 === null
                            ? null
                            : round((float) $costPerM3, 4),

                    'water_gain_m3_per_day' =>
                        round($row['water_gain'], 2),

                    'capex_php' =>
                        round((float) $project->capex_php, 2),

                    'implementation_time_months' =>
                        (int) $project->implementation_time_months,
                ],
            ];
        }

        usort(
            $ranking,
            fn ($a, $b) =>
                $b['public_benefit_score']
                <=>
                $a['public_benefit_score']
        );

        foreach ($ranking as $index => &$item) {
            $item['rank'] = $index + 1;
        }

        return [
            'weights' => $weights,
            'weight_label' => 'CUSTOM POLICY WEIGHTS',
            'ranking' => $ranking,
            'method_note' =>
                'All dimensions are normalized to 0–100 before weighting. Lower lifecycle cost per m³ produces a higher cost-efficiency subscore.',
        ];
    }

    public function normalizeWeights(array $weights): array
    {
        $normalized = [
            'water' => max(
                0,
                (float) ($weights['water'] ?? 0)
            ),
            'equity' => max(
                0,
                (float) ($weights['equity'] ?? 0)
            ),
            'economic' => max(
                0,
                (float) ($weights['economic'] ?? 0)
            ),
            'reliability' => max(
                0,
                (float) ($weights['reliability'] ?? 0)
            ),
            'cost_efficiency' => max(
                0,
                (float) ($weights['cost_efficiency'] ?? 0)
            ),
        ];

        $sum = array_sum($normalized);

        if ($sum <= 0) {
            return self::DEFAULT_WEIGHTS;
        }

        foreach ($normalized as $key => $value) {
            $normalized[$key] = round(
                ($value / $sum) * 100,
                4
            );
        }

        return $normalized;
    }

    private function clampScore(
        float|int|null $value
    ): float {
        return max(
            0,
            min(100, (float) $value)
        );
    }
}
