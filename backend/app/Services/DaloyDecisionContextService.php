<?php

namespace App\Services;

use App\Models\WaterEconomyBarangay;
use App\Models\WaterEconomyProject;

class DaloyDecisionContextService
{
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

        return [
            'location' => [
                'psgc_code' =>
                    $barangay->psgc_code,

                'barangay' =>
                    $barangay->barangay,

                'lgu' =>
                    $barangay->lgu,
            ],

            'water' => [
                'usable_water_m3_day' =>
                    data_get(
                        $state,
                        'water.usable_water_m3_day'
                    ),

                'total_demand_m3_day' =>
                    data_get(
                        $state,
                        'water.total_demand_m3_day'
                    ),

                'deficit_m3_day' =>
                    data_get(
                        $state,
                        'water.deficit_m3_day'
                    ),

                'surplus_m3_day' =>
                    data_get(
                        $state,
                        'water.surplus_m3_day'
                    ),

                'nrw_rate_pct' =>
                    data_get(
                        $state,
                        'water.nrw_rate_pct'
                    ),

                'source_pressure_pct' =>
                    data_get(
                        $state,
                        'water.source_pressure_pct'
                    ),
            ],

            'affordability' => [
                'class' =>
                    data_get(
                        $state,
                        'affordability.affordability_class'
                    ),

                'low_income_class' =>
                    data_get(
                        $state,
                        'affordability.low_income_affordability_class'
                    ),

                'proposed_water_burden_pct' =>
                    data_get(
                        $state,
                        'affordability.proposed_water_burden_pct'
                    ),
            ],

            'demand_response' =>
                data_get(
                    $state,
                    'demand_response'
                ),

            'sector_satisfaction_pct' =>
                data_get(
                    $state,
                    'sector_satisfaction_pct',
                    []
                ),

            'alerts' =>
                data_get(
                    $state,
                    'alerts',
                    []
                ),

            'investment' => [
                'policy_weights' =>
                    $benefit['weights'],

                'weight_label' =>
                    $benefit['weight_label'],

                'ranking' =>
                    array_slice(
                        $benefit['ranking'],
                        0,
                        5
                    ),
            ],

            'data_status' =>
                data_get(
                    $state,
                    'data_status',
                    []
                ),

            'rules' => [
                'calculations_happen_before_ai' =>
                    true,

                'ai_jobs' => [
                    'EXPLAIN',
                    'COMPARE',
                    'SUGGEST',
                    'WARN',
                ],
            ],
        ];
    }
}
