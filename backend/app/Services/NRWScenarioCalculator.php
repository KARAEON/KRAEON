<?php

namespace App\Services;

use App\Models\WaterEconomyBarangay;

class NRWScenarioCalculator
{
    public function calculate(WaterEconomyBarangay $b): array
    {
        /*
        |--------------------------------------------------------------------------
        | USER-INPUT BASE WATER
        |--------------------------------------------------------------------------
        |
        | NRW loss is computed from allocable water.
        | The user does NOT manually enter water loss.
        |
        */

        $allocableWater = max(
            0,
            (float) (
                $b->allocable_water_m3_day
                ?? $b->gross_supply_m3_day
                ?? 0
            )
        );

        $baselineNrwPct = max(
            0,
            min(100, (float) $b->nrw_rate_pct)
        );

        $proposedNrwPct =
            $b->proposed_nrw_rate_pct === null
                ? $baselineNrwPct
                : max(
                    0,
                    min(
                        100,
                        (float) $b->proposed_nrw_rate_pct
                    )
                );

        /*
        |--------------------------------------------------------------------------
        | AUTOMATIC NRW LOSS
        |--------------------------------------------------------------------------
        */

        $baselineLoss =
            $allocableWater *
            ($baselineNrwPct / 100);

        $scenarioLoss =
            $allocableWater *
            ($proposedNrwPct / 100);

        $baselineUsable =
            max(
                0,
                $allocableWater -
                $baselineLoss
            );

        $scenarioUsable =
            max(
                0,
                $allocableWater -
                $scenarioLoss
            );

        $recoveredWater =
            max(
                0,
                $baselineLoss -
                $scenarioLoss
            );

        $usableWaterGain =
            max(
                0,
                $scenarioUsable -
                $baselineUsable
            );

        $nrwReductionPoints =
            max(
                0,
                $baselineNrwPct -
                $proposedNrwPct
            );

        $nrwIncreasePoints =
            max(
                0,
                $proposedNrwPct -
                $baselineNrwPct
            );

        /*
        |--------------------------------------------------------------------------
        | DEMAND + DEFICIT EFFECT
        |--------------------------------------------------------------------------
        */

        $totalDemand =
            $this->totalDemand($b);

        $baselineDeficit =
            max(
                0,
                $totalDemand -
                $baselineUsable
            );

        $scenarioDeficit =
            max(
                0,
                $totalDemand -
                $scenarioUsable
            );

        $deficitReduction =
            max(
                0,
                $baselineDeficit -
                $scenarioDeficit
            );

        /*
        |--------------------------------------------------------------------------
        | OPTIONAL TARIFF-BASED INDICATOR
        |--------------------------------------------------------------------------
        */

        $tariff =
            max(
                0,
                (float) $b->tariff_php_m3
            );

        $recoveredTariffValueDay =
            $tariff > 0
                ? $recoveredWater * $tariff
                : null;

        $recoveredTariffValueYear =
            $recoveredTariffValueDay !== null
                ? $recoveredTariffValueDay * 365
                : null;

        /*
        |--------------------------------------------------------------------------
        | RULE-BASED ALERTS
        |--------------------------------------------------------------------------
        */

        $alerts = [];

        if ($baselineNrwPct >= 30) {
            $alerts[] = [
                'severity' => 'warning',
                'code' => 'NRW_HIGH',
                'title' => 'High NRW level',
                'message' =>
                    'The current NRW percentage is causing a large automatic water loss from allocable water.',
                'ai_action' =>
                    'Explain the current loss and compare NRW reduction with adding new supply.',
            ];
        }

        if ($nrwIncreasePoints > 0) {
            $alerts[] = [
                'severity' => 'warning',
                'code' => 'NRW_WORSENING',
                'title' => 'NRW scenario increases water loss',
                'message' =>
                    'The proposed NRW percentage is higher than the current NRW percentage, so automatic water loss increases.',
                'metric' => [
                    'nrw_increase_percentage_points' =>
                        round(
                            $nrwIncreasePoints,
                            2
                        ),

                    'scenario_loss_m3_day' =>
                        round(
                            $scenarioLoss,
                            2
                        ),
                ],
                'ai_action' =>
                    'Explain the additional loss and which users or sectors may be exposed.',
            ];
        }

        if ($nrwReductionPoints >= 5) {
            $alerts[] = [
                'severity' => 'advisory',
                'code' => 'NRW_RECOVERY_GAIN',
                'title' => 'Meaningful water recovery',
                'message' =>
                    'Reducing NRW automatically recovers usable water from the same allocable supply.',
                'metric' => [
                    'recovered_water_m3_day' =>
                        round(
                            $recoveredWater,
                            2
                        ),

                    'nrw_reduction_percentage_points' =>
                        round(
                            $nrwReductionPoints,
                            2
                        ),
                ],
                'ai_action' =>
                    'Explain how much water is recovered and whether it materially reduces the deficit.',
            ];
        }

        if (
            $baselineDeficit > 0 &&
            $scenarioDeficit == 0
        ) {
            $alerts[] = [
                'severity' => 'advisory',
                'code' => 'NRW_CLOSES_DEFICIT',
                'title' => 'NRW scenario closes the modeled deficit',
                'message' =>
                    'The recovered water is enough to remove the modeled deficit under this scenario.',
                'ai_action' =>
                    'Explain the benefit and note that implementation cost and feasibility still need evaluation.',
            ];
        }

        if (count($alerts) === 0) {
            $alerts[] = [
                'severity' => 'advisory',
                'code' => 'NRW_STABLE',
                'title' => 'NRW scenario calculated',
                'message' =>
                    'The NRW scenario has been calculated from allocable water and the configured NRW percentage.',
                'ai_action' =>
                    'Explain the result and suggest an NRW sensitivity test.',
            ];
        }

        return [
            'allocable_water_m3_day' =>
                round(
                    $allocableWater,
                    2
                ),

            'baseline_nrw_rate_pct' =>
                round(
                    $baselineNrwPct,
                    2
                ),

            'proposed_nrw_rate_pct' =>
                round(
                    $proposedNrwPct,
                    2
                ),

            'nrw_reduction_percentage_points' =>
                round(
                    $nrwReductionPoints,
                    2
                ),

            'baseline_nrw_loss_m3_day' =>
                round(
                    $baselineLoss,
                    2
                ),

            'scenario_nrw_loss_m3_day' =>
                round(
                    $scenarioLoss,
                    2
                ),

            'recovered_water_m3_day' =>
                round(
                    $recoveredWater,
                    2
                ),

            'baseline_usable_water_m3_day' =>
                round(
                    $baselineUsable,
                    2
                ),

            'scenario_usable_water_m3_day' =>
                round(
                    $scenarioUsable,
                    2
                ),

            'usable_water_gain_m3_day' =>
                round(
                    $usableWaterGain,
                    2
                ),

            'total_demand_m3_day' =>
                round(
                    $totalDemand,
                    2
                ),

            'baseline_deficit_m3_day' =>
                round(
                    $baselineDeficit,
                    2
                ),

            'scenario_deficit_m3_day' =>
                round(
                    $scenarioDeficit,
                    2
                ),

            'deficit_reduction_m3_day' =>
                round(
                    $deficitReduction,
                    2
                ),

            'configured_tariff_php_m3' =>
                round(
                    $tariff,
                    2
                ),

            'recovered_water_tariff_value_php_day' =>
                $recoveredTariffValueDay === null
                    ? null
                    : round(
                        $recoveredTariffValueDay,
                        2
                    ),

            'recovered_water_tariff_value_php_year' =>
                $recoveredTariffValueYear === null
                    ? null
                    : round(
                        $recoveredTariffValueYear,
                        2
                    ),

            'formula' => [
                'nrw_loss' =>
                    'allocable_water × (nrw_percentage / 100)',

                'usable_water' =>
                    'allocable_water - nrw_loss',

                'recovered_water' =>
                    'baseline_nrw_loss - scenario_nrw_loss',
            ],

            'value_note' =>
                'Tariff-based recovered-water value is a scenario indicator only, not automatically an economic benefit.',

            'alerts' =>
                $alerts,
        ];
    }

    private function totalDemand(
        WaterEconomyBarangay $b
    ): float {
        return
            max(
                0,
                (float) $b->household_demand_m3_day
            ) +
            max(
                0,
                (float) $b->critical_services_demand_m3_day
            ) +
            max(
                0,
                (float) $b->agriculture_demand_m3_day
            ) +
            max(
                0,
                (float) $b->fisheries_demand_m3_day
            ) +
            max(
                0,
                (float) $b->aquaculture_demand_m3_day
            ) +
            max(
                0,
                (float) $b->business_demand_m3_day
            ) +
            max(
                0,
                (float) $b->industry_demand_m3_day
            );
    }
}
