<?php

namespace App\Services;

use App\Models\WaterEconomyBarangay;
use App\Models\WaterEconomyProject;

class DecisionSnapshotService
{
    public function build(
        WaterEconomyBarangay $barangay,
        WaterEconomyCalculator $calculator,
        InterventionValuationService $valuationService
    ): array {
        /*
        |--------------------------------------------------------------------------
        | 1. CALCULATE FIRST
        |--------------------------------------------------------------------------
        |
        | No. 20 must be grounded in calculation-engine results.
        | AI is allowed to rewrite/explain later, but not invent the numbers.
        |
        */

        $state = $calculator->calculate($barangay);

        $projects = WaterEconomyProject::where(
            'psgc_code',
            $barangay->psgc_code
        )->get();

        $valuations = collect(
            $valuationService->valueCollection($projects)
        );

        /*
        |--------------------------------------------------------------------------
        | 2. DETERMINE STRONGEST CURRENT PROJECT OPTION
        |--------------------------------------------------------------------------
        |
        | Until No. 15 Benefit/Peso exists, use lowest valid simple lifecycle
        | cost per m3 as the economic project signal.
        |
        */

        $validCostProjects = $valuations
            ->filter(function ($item) {
                return data_get(
                    $item,
                    'valuation.simple_lifecycle_cost_per_m3_php'
                ) !== null;
            })
            ->sortBy(function ($item) {
                return data_get(
                    $item,
                    'valuation.simple_lifecycle_cost_per_m3_php'
                );
            })
            ->values();

        $bestProject =
            $validCostProjects->first();

        /*
        |--------------------------------------------------------------------------
        | 3. STRUCTURED "WHY"
        |--------------------------------------------------------------------------
        */

        $why = [];

        if ($bestProject) {
            $why[] = [
                'type' => 'economy',
                'text' =>
                    $bestProject['name'] .
                    ' has the lowest current simple lifecycle cost per m³ among saved interventions at ₱' .
                    number_format(
                        (float) data_get(
                            $bestProject,
                            'valuation.simple_lifecycle_cost_per_m3_php'
                        ),
                        2
                    ) .
                    '/m³.',
            ];

            $waterGain = (float) data_get(
                $bestProject,
                'inputs.water_gain_m3_per_day',
                0
            );

            if ($waterGain > 0) {
                $why[] = [
                    'type' => 'water',
                    'text' =>
                        'It adds approximately ' .
                        number_format($waterGain, 2) .
                        ' m³/day of modeled water benefit.',
                ];
            }
        }

        $deficit = (float) data_get(
            $state,
            'water.deficit_m3_day',
            0
        );

        $sourcePressure = data_get(
            $state,
            'water.source_pressure_pct'
        );

        if ($deficit > 0) {
            $why[] = [
                'type' => 'water',
                'text' =>
                    'The current calculated water deficit is ' .
                    number_format($deficit, 2) .
                    ' m³/day, so added/recovered water has immediate decision value.',
            ];
        }

        if (
            $sourcePressure !== null &&
            (float) $sourcePressure >= 80
        ) {
            $why[] = [
                'type' => 'pressure',
                'text' =>
                    'Current source pressure is ' .
                    number_format(
                        (float) $sourcePressure,
                        2
                    ) .
                    '%, indicating pressure on available source capacity.',
            ];
        }

        /*
        |--------------------------------------------------------------------------
        | 4. TRADE-OFF
        |--------------------------------------------------------------------------
        */

        $tradeoff = null;

        if ($bestProject) {
            $implementationMonths =
                (int) WaterEconomyProject::find(
                    $bestProject['project_id']
                )?->implementation_time_months;

            $capex =
                (float) data_get(
                    $bestProject,
                    'inputs.capex_php',
                    0
                );

            $tradeoff =
                'The intervention requires approximately ₱' .
                number_format($capex, 2) .
                ' in upfront CAPEX';

            if ($implementationMonths > 0) {
                $tradeoff .=
                    ' and about ' .
                    $implementationMonths .
                    ' months of implementation time';
            }

            $tradeoff .= '.';
        } else {
            $tradeoff =
                'No saved intervention has enough valuation data yet, so project trade-offs cannot be compared.';
        }

        /*
        |--------------------------------------------------------------------------
        | 5. AFFORDABILITY / PEOPLE WARNING
        |--------------------------------------------------------------------------
        */

        $affordabilityClass = data_get(
            $state,
            'affordability.affordability_class'
        );

        if (
            $affordabilityClass === 'HIGH'
        ) {
            $tradeoff .=
                ' Household affordability is currently in the configured HIGH-pressure range, so financing choices should avoid worsening household burden.';
        }

        /*
        |--------------------------------------------------------------------------
        | 6. CONFIDENCE
        |--------------------------------------------------------------------------
        |
        | We use MODERATE because current project and water-economic fields may
        | include simulated/user-entered assumptions. Do not call it "high"
        | confidence unless the system later has verified source-backed inputs.
        |
        */

        $confidence = [
            'label' => 'SIMULATED / MODERATE',
            'level' => 'MODERATE',
            'basis' =>
                'The snapshot is generated from current calculation-engine results and saved intervention data, which may include simulated or user-entered assumptions.',
        ];

        /*
        |--------------------------------------------------------------------------
        | 7. SNAPSHOT TITLE
        |--------------------------------------------------------------------------
        */

        $strongestTradeoff = $bestProject
            ? $bestProject['name']
            : 'No intervention selected yet';

        return [
            'psgc_code' =>
                $barangay->psgc_code,

            'barangay' =>
                $barangay->barangay,

            'lgu' =>
                $barangay->lgu,

            'strongest_current_tradeoff' =>
                $strongestTradeoff,

            'why' =>
                array_slice(
                    $why,
                    0,
                    3
                ),

            'tradeoff' =>
                $tradeoff,

            'confidence' =>
                $confidence,

            'calculation_context' => [
                'deficit_m3_day' =>
                    data_get(
                        $state,
                        'water.deficit_m3_day'
                    ),

                'source_pressure_pct' =>
                    data_get(
                        $state,
                        'water.source_pressure_pct'
                    ),

                'affordability_class' =>
                    data_get(
                        $state,
                        'affordability.affordability_class'
                    ),

                'selected_project' =>
                    $bestProject
                        ? [
                            'project_id' =>
                                $bestProject['project_id'],

                            'name' =>
                                $bestProject['name'],

                            'simple_lifecycle_cost_per_m3_php' =>
                                data_get(
                                    $bestProject,
                                    'valuation.simple_lifecycle_cost_per_m3_php'
                                ),

                            'water_gain_m3_per_day' =>
                                data_get(
                                    $bestProject,
                                    'inputs.water_gain_m3_per_day'
                                ),
                        ]
                        : null,
            ],

            'generated_by' =>
                'CALCULATION_ENGINE',

            'ai_rewrite_allowed' =>
                true,
        ];
    }
}
