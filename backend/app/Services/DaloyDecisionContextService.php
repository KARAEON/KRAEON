<?php

namespace App\Services;

use App\Models\WaterEconomyBarangay;
use App\Models\WaterEconomyProject;

class DaloyDecisionContextService
{
    public function populationContext(string $question, ?string $selectedCode = null): array
    {
        $barangays = WaterEconomyBarangay::query()
            ->get(['psgc_code', 'lgu', 'barangay', 'population_2024', 'data_status']);

        $relevant = $barangays->filter(function (WaterEconomyBarangay $row) use ($question, $selectedCode): bool {
            return $row->psgc_code === $selectedCode
                || str_contains($question, $row->psgc_code)
                || ($row->barangay !== '' && preg_match('/(?<!\pL)'.preg_quote($row->barangay, '/').'(?!\pL)/iu', $question) === 1);
        })->take(5);
        $withPopulation = $barangays->whereNotNull('population_2024');
        $records = $relevant
            ->concat($withPopulation->sortByDesc('population_2024')->take(5))
            ->concat($withPopulation->sortBy('population_2024')->take(5))
            ->unique('psgc_code')->values();

        return [
            'year' => 2024,
            'scope' => 'Stored barangay records only; totals may cover only part of an LGU.',
            'barangay_scope' => 'Only question matches and the five highest/lowest recorded populations are included, not every barangay.',
            'highest_population_codes' => $withPopulation->sortByDesc('population_2024')->take(5)->pluck('psgc_code')->values()->all(),
            'lowest_population_codes' => $withPopulation->sortBy('population_2024')->take(5)->pluck('psgc_code')->values()->all(),
            'lgu_totals' => $barangays->groupBy('lgu')->map(function ($rows, $lgu): array {
                return [
                    'lgu' => $lgu,
                    'recorded_population' => $rows->whereNotNull('population_2024')->isEmpty()
                        ? null : $rows->sum('population_2024'),
                    'barangay_count' => $rows->count(),
                    'population_record_count' => $rows->whereNotNull('population_2024')->count(),
                ];
            })->values()->all(),
            'barangays' => $records->map(fn (WaterEconomyBarangay $row): array => [
                'psgc_code' => $row->psgc_code,
                'lgu' => $row->lgu,
                'barangay' => $row->barangay,
                'population_2024' => $row->population_2024,
                'data_status' => data_get($row->data_status, 'population_2024', 'Unspecified'),
            ])->all(),
        ];
    }

    public function build(
        WaterEconomyBarangay $barangay,
        WaterEconomyCalculator $calculator,
        InterventionValuationService $valuationService,
        PublicBenefitPerPesoService $benefitService
    ): array {
        $state =
            $calculator->calculate(
                $barangay
            );

        $projects =
            WaterEconomyProject::where(
                'psgc_code',
                $barangay->psgc_code
            )->get();

        $benefit =
            $benefitService->rank(
                $projects,
                $valuationService
            );

        $affordability = data_get($state, 'affordability', []);
        $affordability['average_household_tariff_at_low_threshold_php_m3'] = $this->tariffAtThreshold(
            data_get($affordability, 'avg_household_income_php'),
            data_get($affordability, 'monthly_consumption_m3'),
            data_get($affordability, 'policy_thresholds.low_below_pct')
        );
        $affordability['low_income_tariff_at_low_threshold_php_m3'] = $this->tariffAtThreshold(
            data_get($affordability, 'low_income_monthly_income_php'),
            data_get($affordability, 'monthly_consumption_m3'),
            data_get($affordability, 'policy_thresholds.low_below_pct')
        );

        return [
            'location' => [
                'psgc_code' => $barangay->psgc_code,

                'barangay' => $barangay->barangay,

                'lgu' => $barangay->lgu,
            ],

            'population' => data_get($state, 'population', []),

            'water' => [
                'usable_water_m3_day' => data_get(
                    $state,
                    'water.usable_water_m3_day'
                ),

                'total_demand_m3_day' => data_get(
                    $state,
                    'water.total_demand_m3_day'
                ),

                'deficit_m3_day' => data_get(
                    $state,
                    'water.deficit_m3_day'
                ),

                'surplus_m3_day' => data_get(
                    $state,
                    'water.surplus_m3_day'
                ),

                'nrw_rate_pct' => data_get(
                    $state,
                    'water.nrw_rate_pct'
                ),

                'source_pressure_pct' => data_get(
                    $state,
                    'water.source_pressure_pct'
                ),
            ],

            'affordability' => $affordability,

            'demand_response' => data_get(
                $state,
                'demand_response'
            ),

            'sector_satisfaction_pct' => data_get(
                $state,
                'sector_satisfaction_pct',
                []
            ),

            'alerts' => data_get(
                $state,
                'alerts',
                []
            ),

            'investment' => [
                'policy_weights' => $benefit['weights'],

                'weight_label' => $benefit['weight_label'],

                'ranking' => array_slice(
                    $benefit['ranking'],
                    0,
                    5
                ),
            ],

            'data_status' => data_get(
                $state,
                'data_status',
                []
            ),

            'rules' => [
                'calculations_happen_before_ai' => true,

                'ai_jobs' => [
                    'EXPLAIN',
                    'COMPARE',
                    'SUGGEST',
                    'WARN',
                ],
            ],
        ];
    }

    private function tariffAtThreshold(mixed $income, mixed $monthlyConsumption, mixed $thresholdPct): ?float
    {
        $income = (float) $income;
        $monthlyConsumption = (float) $monthlyConsumption;
        $thresholdPct = (float) $thresholdPct;

        if ($income <= 0 || $monthlyConsumption <= 0 || $thresholdPct < 0) {
            return null;
        }

        return round(($income * $thresholdPct / 100) / $monthlyConsumption, 2);
    }
}
