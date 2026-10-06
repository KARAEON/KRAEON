<?php

namespace App\Services;

use App\Models\WaterEconomyBarangay;

class WaterEconomyCalculator
{
    public function calculate(WaterEconomyBarangay $b): array
    {
        /*
        |--------------------------------------------------------------------------
        | WATER SUPPLY
        |--------------------------------------------------------------------------
        */

        $grossSupply = max(
            0,
            (float) $b->gross_supply_m3_day
        );

        $nrwRate = $this->pct(
            $b->nrw_rate_pct
        );

        $reserveRate = $this->pct(
            $b->reserve_rate_pct
        );

        $nrwVolume =
            $grossSupply * $nrwRate;

        $reserveVolume =
            $grossSupply * $reserveRate;

        $usableWater = max(
            0,
            $grossSupply -
            $nrwVolume -
            $reserveVolume
        );

        /*
        |--------------------------------------------------------------------------
        | BASELINE SECTOR DEMAND
        |--------------------------------------------------------------------------
        */

        $baselineDemands = [
            'households' => max(
                0,
                (float) $b->household_demand_m3_day
            ),

            'critical_services' => max(
                0,
                (float) $b->critical_services_demand_m3_day
            ),

            'agriculture' => max(
                0,
                (float) $b->agriculture_demand_m3_day
            ),

            'fisheries' => max(
                0,
                (float) $b->fisheries_demand_m3_day
            ),

            'aquaculture' => max(
                0,
                (float) $b->aquaculture_demand_m3_day
            ),

            'business' => max(
                0,
                (float) $b->business_demand_m3_day
            ),

            'industry' => max(
                0,
                (float) $b->industry_demand_m3_day
            ),
        ];

        $baselineTotalDemand =
            array_sum($baselineDemands);

        /*
        |--------------------------------------------------------------------------
        | NO. 10 — DEMAND-RESPONSE ASSUMPTION
        |--------------------------------------------------------------------------
        |
        | IMPORTANT:
        | This is a USER ASSUMPTION.
        |
        | We DO NOT infer:
        | +10% tariff = -10% demand.
        |
        | Instead the user enters the expected demand response.
        |
        | Example:
        | Baseline demand = 10,000 m3/day
        | Demand response = -4%
        | Adjusted demand = 9,600 m3/day
        |
        */

        $demandResponsePct = max(
            -100,
            min(
                100,
                (float) $b->demand_response_pct
            )
        );

        $demandMultiplier =
            1 + ($demandResponsePct / 100);

        $adjustedDemands = [];

        foreach (
            $baselineDemands as $sector => $demand
        ) {
            /*
            | MVP assumption:
            | Apply the user-entered response proportionally
            | across current modeled sector demand.
            |
            | This is intentionally labeled USER ASSUMPTION.
            */

            $adjustedDemands[$sector] =
                max(
                    0,
                    $demand *
                    $demandMultiplier
                );
        }

        $adjustedTotalDemand =
            array_sum($adjustedDemands);

        $demandChangeM3Day =
            $adjustedTotalDemand -
            $baselineTotalDemand;

        /*
        |--------------------------------------------------------------------------
        | ALLOCATIONS
        |--------------------------------------------------------------------------
        */

        $allocations = [
            'households' => max(
                0,
                (float) $b->household_allocated_m3_day
            ),

            'critical_services' => max(
                0,
                (float) $b->critical_services_allocated_m3_day
            ),

            'agriculture' => max(
                0,
                (float) $b->agriculture_allocated_m3_day
            ),

            'fisheries' => max(
                0,
                (float) $b->fisheries_allocated_m3_day
            ),

            'aquaculture' => max(
                0,
                (float) $b->aquaculture_allocated_m3_day
            ),

            'business' => max(
                0,
                (float) $b->business_allocated_m3_day
            ),

            'industry' => max(
                0,
                (float) $b->industry_allocated_m3_day
            ),
        ];

        /*
        |--------------------------------------------------------------------------
        | CONNECT DEMAND RESPONSE TO WATER ECONOMY
        |--------------------------------------------------------------------------
        |
        | Deficit, surplus, source pressure, and sector satisfaction
        | now react to the adjusted demand.
        |
        */

        $deficit = max(
            0,
            $adjustedTotalDemand -
            $usableWater
        );

        $surplus = max(
            0,
            $usableWater -
            $adjustedTotalDemand
        );

        $sourceCapacity = max(
            0,
            (float) $b->source_capacity_m3_day
        );

        $sourcePressure =
            $sourceCapacity > 0
                ? (
                    $adjustedTotalDemand /
                    $sourceCapacity
                ) * 100
                : null;

        $sectorSatisfaction = [];

        foreach (
            $adjustedDemands as $sector => $demand
        ) {
            $allocated =
                $allocations[$sector] ?? 0;

            $sectorSatisfaction[$sector] =
                $demand > 0
                    ? min(
                        100,
                        (
                            $allocated /
                            $demand
                        ) * 100
                    )
                    : 100;
        }

        /*
        |--------------------------------------------------------------------------
        | POPULATION
        |--------------------------------------------------------------------------
        */

        $estimatedHouseholds = max(
            1,
            (int) round(
                $b->population_2024 /
                max(
                    1,
                    (float) $b->avg_household_size
                )
            )
        );

        /*
        |--------------------------------------------------------------------------
        | TARIFF + AFFORDABILITY
        |--------------------------------------------------------------------------
        */

        $currentTariff = max(
            0,
            (float) $b->tariff_php_m3
        );

        $proposedTariff = max(
            0,
            (float) $b->proposed_tariff_php_m3
        );

        $monthlyConsumption = max(
            0,
            (float) $b->monthly_consumption_m3
        );

        $adjustedMonthlyConsumption = max(
            0,
            $monthlyConsumption * $demandMultiplier
        );

        $avgIncome = max(
            0,
            (float) $b->avg_household_income_php
        );

        $lowIncome = max(
            0,
            (float) $b->low_income_monthly_income_php
        );

        $currentBill =
            $monthlyConsumption *
            $currentTariff;

        $proposedBill =
            $adjustedMonthlyConsumption *
            $proposedTariff;

        $currentWaterBurden =
            $avgIncome > 0
                ? (
                    $currentBill /
                    $avgIncome
                ) * 100
                : null;

        $proposedWaterBurden =
            $avgIncome > 0
                ? (
                    $proposedBill /
                    $avgIncome
                ) * 100
                : null;

        $lowIncomeWaterBurden =
            $lowIncome > 0
                ? (
                    $proposedBill /
                    $lowIncome
                ) * 100
                : null;

        /*
        | Keep household monthly-demand response
        | visible inside tariff/affordability too.
        */

        $tariffChangePct =
            $currentTariff > 0
                ? (
                    (
                        $proposedTariff -
                        $currentTariff
                    ) /
                    $currentTariff
                ) * 100
                : null;

        $lowThreshold = max(
            0,
            (float) $b->affordability_low_threshold_pct
        );

        $highThreshold = max(
            $lowThreshold,
            (float) $b->affordability_high_threshold_pct
        );

        $affordabilityClass =
            $this->affordabilityClass(
                $proposedWaterBurden,
                $lowThreshold,
                $highThreshold
            );

        $lowIncomeAffordabilityClass =
            $this->affordabilityClass(
                $lowIncomeWaterBurden,
                $lowThreshold,
                $highThreshold
            );

        /*
        |--------------------------------------------------------------------------
        | ALERTS
        |--------------------------------------------------------------------------
        */

        $alerts = $this->alerts(
            deficit: $deficit,
            sourcePressure: $sourcePressure,
            nrwPct: (float) $b->nrw_rate_pct,
            reliabilityPct: (float) $b->supply_reliability_pct,
            sectorSatisfaction: $sectorSatisfaction,
            proposedWaterBurdenPct: $proposedWaterBurden,
            lowIncomeWaterBurdenPct: $lowIncomeWaterBurden,
            tariffChangePct: $tariffChangePct,
            demandResponsePct: $demandResponsePct,
            demandChangeM3Day: $demandChangeM3Day,
            lowThresholdPct: $lowThreshold,
            highThresholdPct: $highThreshold
        );

        /*
        |--------------------------------------------------------------------------
        | RESPONSE
        |--------------------------------------------------------------------------
        */

        return [
            'municipality' => $b->lgu,

            'barangay' => $b->barangay,

            'psgc_code' => $b->psgc_code,

            'data_version' => $b->data_version,

            'updated_at' => optional(
                $b->updated_at
            )->toIso8601String(),

            'population' => [
            'population_2024' => $b->population_2024,

            'avg_household_size' => (float) $b->avg_household_size,

            'estimated_households' => $estimatedHouseholds,
            ],

            'water' => [
            'gross_supply_m3_day' => round(
                $grossSupply,
                2
            ),

            'nrw_rate_pct' => round(
                (float) $b->nrw_rate_pct,
                2
            ),

            'nrw_volume_m3_day' => round(
                $nrwVolume,
                2
            ),

            'reserve_rate_pct' => round(
                (float) $b->reserve_rate_pct,
                2
            ),

            'reserve_volume_m3_day' => round(
                $reserveVolume,
                2
            ),

            'usable_water_m3_day' => round(
                $usableWater,
                2
            ),

            /*
                | Keep both baseline and adjusted demand.
                */

            'baseline_total_demand_m3_day' => round(
                $baselineTotalDemand,
                2
            ),

            'adjusted_total_demand_m3_day' => round(
                $adjustedTotalDemand,
                2
            ),

            /*
                | total_demand_m3_day now represents
                | the ACTIVE adjusted scenario.
                */

            'total_demand_m3_day' => round(
                $adjustedTotalDemand,
                2
            ),

            'demand_change_m3_day' => round(
                $demandChangeM3Day,
                2
            ),

            'deficit_m3_day' => round(
                $deficit,
                2
            ),

            'surplus_m3_day' => round(
                $surplus,
                2
            ),

            'source_capacity_m3_day' => round(
                $sourceCapacity,
                2
            ),

            'source_pressure_pct' => $sourcePressure === null
                    ? null
                    : round(
                        $sourcePressure,
                        2
                    ),

            'supply_reliability_pct' => round(
                (float) $b->supply_reliability_pct,
                2
            ),

            'piped_access_pct' => round(
                (float) $b->piped_access_pct,
                2
            ),
            ],

            /*
            |--------------------------------------------------------------------------
            | NO. 10 STRUCTURED RESULT
            |--------------------------------------------------------------------------
            */

            'demand_response' => [
                'baseline_demand_m3_day' => round(
                    $baselineTotalDemand,
                    2
                ),

                'expected_demand_response_pct' => round(
                    $demandResponsePct,
                    2
                ),

                'adjusted_demand_m3_day' => round(
                    $adjustedTotalDemand,
                    2
                ),

                'demand_change_m3_day' => round(
                    $demandChangeM3Day,
                    2
                ),

                'status' => 'USER ASSUMPTION',

                'formula' => 'Adjusted Demand = Baseline Demand × (1 + Demand Response)',
            ],

            'affordability' => [
                'current_tariff_php_m3' => round(
                    $currentTariff,
                    2
                ),

                'proposed_tariff_php_m3' => round(
                    $proposedTariff,
                    2
                ),

                'tariff_change_pct' => $tariffChangePct === null
                    ? null
                    : round(
                        $tariffChangePct,
                        2
                    ),

                'monthly_consumption_m3' => round(
                    $monthlyConsumption,
                    2
                ),

                'current_monthly_bill_php' => round(
                    $currentBill,
                    2
                ),

                'proposed_monthly_bill_php' => round(
                    $proposedBill,
                    2
                ),

                'avg_household_income_php' => round(
                    $avgIncome,
                    2
                ),

                'low_income_monthly_income_php' => round(
                    $lowIncome,
                    2
                ),

                'current_water_burden_pct' => $currentWaterBurden === null
                    ? null
                    : round(
                        $currentWaterBurden,
                        2
                    ),

                'proposed_water_burden_pct' => $proposedWaterBurden === null
                    ? null
                    : round(
                        $proposedWaterBurden,
                        2
                    ),

                'low_income_water_burden_pct' => $lowIncomeWaterBurden === null
                    ? null
                    : round(
                        $lowIncomeWaterBurden,
                        2
                    ),

                'affordability_class' => $affordabilityClass,

                'low_income_affordability_class' => $lowIncomeAffordabilityClass,

                'policy_thresholds' => [
                    'low_below_pct' => round(
                        $lowThreshold,
                        2
                    ),

                    'high_at_or_above_pct' => round(
                        $highThreshold,
                        2
                    ),

                    'status' => 'USER CONFIGURABLE POLICY THRESHOLDS',
                ],

                'demand_response_pct' => round(
                    $demandResponsePct,
                    2
                ),

                'adjusted_monthly_consumption_m3' => round(
                    $adjustedMonthlyConsumption,
                    2
                ),

                'demand_response_status' => 'USER ASSUMPTION',
            ],

            'sector_demand_baseline_m3_day' => $this->roundArray(
                $baselineDemands
            ),

            'sector_demand_adjusted_m3_day' => $this->roundArray(
                $adjustedDemands
            ),

            /*
            | Keep this alias for older frontend code.
            | It now represents active adjusted demand.
            */

            'sector_demand_m3_day' => $this->roundArray(
                $adjustedDemands
            ),

            'sector_allocation_m3_day' => $this->roundArray(
                $allocations
            ),

            'sector_satisfaction_pct' => $this->roundArray(
                $sectorSatisfaction
            ),

            'sector_meta' => $b->sector_meta ?? [],

            'livelihood_profile' => $b->livelihood_profile,

            'alerts' => $alerts,

            'data_status' => $b->data_status ?? [],
        ];
    }

    private function affordabilityClass(
        ?float $burdenPct,
        float $lowThreshold,
        float $highThreshold
    ): string {
        if ($burdenPct === null) {
            return 'UNKNOWN';
        }

        if ($burdenPct < $lowThreshold) {
            return 'LOW';
        }

        if ($burdenPct < $highThreshold) {
            return 'MODERATE';
        }

        return 'HIGH';
    }

    private function pct(
        float|int|null $value
    ): float {
        return max(
            0,
            min(
                100,
                (float) $value
            )
        ) / 100;
    }

    private function roundArray(
        array $values
    ): array {
        return array_map(
            fn ($value) => round(
                (float) $value,
                2
            ),
            $values
        );
    }

    private function alerts(
        float $deficit,
        ?float $sourcePressure,
        float $nrwPct,
        float $reliabilityPct,
        array $sectorSatisfaction,
        ?float $proposedWaterBurdenPct,
        ?float $lowIncomeWaterBurdenPct,
        ?float $tariffChangePct,
        float $demandResponsePct,
        float $demandChangeM3Day,
        float $lowThresholdPct,
        float $highThresholdPct
    ): array {
        $alerts = [];

        if ($deficit > 0) {
            $alerts[] = [
                'severity' => 'critical',

                'code' => 'WATER_DEFICIT',

                'title' => 'Water deficit detected',

                'message' => 'Adjusted demand exceeds usable water.',

                'ai_action' => 'Explain which users are most exposed and suggest a scenario to test.',
            ];
        }

        if (
            $sourcePressure !== null &&
            $sourcePressure > 100
        ) {
            $alerts[] = [
                'severity' => 'critical',

                'code' => 'SOURCE_OVERDRAWN',

                'title' => 'Source pressure exceeds capacity',

                'message' => 'Adjusted demand is above configured source capacity.',

                'ai_action' => 'Explain the trade-off between reducing demand, recovering NRW, and adding supply.',
            ];
        } elseif (
            $sourcePressure !== null &&
            $sourcePressure >= 80
        ) {
            $alerts[] = [
                'severity' => 'warning',

                'code' => 'SOURCE_PRESSURE_HIGH',

                'title' => 'High source pressure',

                'message' => 'Adjusted demand is using at least 80% of configured source capacity.',

                'ai_action' => 'Suggest a resilience scenario to test.',
            ];
        }

        if ($nrwPct >= 30) {
            $alerts[] = [
                'severity' => 'warning',

                'code' => 'NRW_HIGH',

                'title' => 'High NRW assumption',

                'message' => 'A large share of supply is being treated as non-revenue water.',

                'ai_action' => 'Compare NRW reduction with new supply investment.',
            ];
        }

        if (
            $reliabilityPct > 0 &&
            $reliabilityPct < 70
        ) {
            $alerts[] = [
                'severity' => 'warning',

                'code' => 'RELIABILITY_LOW',

                'title' => 'Low supply reliability',

                'message' => 'Configured supply reliability is below 70%.',

                'ai_action' => 'Explain which interventions could improve reliability.',
            ];
        }

        /*
        |--------------------------------------------------------------------------
        | NO. 10 DEMAND RESPONSE ALERTS
        |--------------------------------------------------------------------------
        */

        if ($demandResponsePct <= -10) {
            $alerts[] = [
                'severity' => 'advisory',

                'code' => 'DEMAND_RESPONSE_REDUCTION',

                'title' => 'Material demand reduction assumption',

                'message' => 'The user-entered demand-response assumption materially reduces modeled demand.',

                'metric' => [
                    'demand_response_pct' => round(
                        $demandResponsePct,
                        2
                    ),

                    'demand_change_m3_day' => round(
                        $demandChangeM3Day,
                        2
                    ),
                ],

                'ai_action' => 'Explain the water-system benefit and remind the user that this is an assumption to sensitivity-test.',
            ];
        } elseif ($demandResponsePct > 0) {
            $alerts[] = [
                'severity' => 'warning',

                'code' => 'DEMAND_RESPONSE_INCREASE',

                'title' => 'Demand growth assumption',

                'message' => 'The user-entered demand-response assumption increases modeled demand.',

                'metric' => [
                    'demand_response_pct' => round(
                        $demandResponsePct,
                        2
                    ),

                    'demand_change_m3_day' => round(
                        $demandChangeM3Day,
                        2
                    ),
                ],

                'ai_action' => 'Explain how the higher demand affects deficit and source pressure.',
            ];
        }

        /*
        |--------------------------------------------------------------------------
        | AFFORDABILITY ALERTS
        |--------------------------------------------------------------------------
        */

        if (
            $proposedWaterBurdenPct !== null &&
            $proposedWaterBurdenPct >=
                $highThresholdPct
        ) {
            $alerts[] = [
                'severity' => 'critical',

                'code' => 'AFFORDABILITY_HIGH',

                'title' => 'High affordability pressure',

                'message' => 'The proposed tariff pushes average household water burden into the configured HIGH range.',

                'ai_action' => 'Explain the affordability risk and suggest a lower tariff, lifeline rate, or targeted subsidy scenario.',
            ];
        } elseif (
            $proposedWaterBurdenPct !== null &&
            $proposedWaterBurdenPct >=
                $lowThresholdPct
        ) {
            $alerts[] = [
                'severity' => 'warning',

                'code' => 'AFFORDABILITY_MODERATE',

                'title' => 'Moderate affordability pressure',

                'message' => 'The proposed tariff places average household water burden in the configured MODERATE range.',

                'ai_action' => 'Explain whether a subsidy or smaller tariff increase should be tested.',
            ];
        }

        if (
            $lowIncomeWaterBurdenPct !== null &&
            $lowIncomeWaterBurdenPct >=
                $highThresholdPct
        ) {
            $alerts[] = [
                'severity' => 'critical',

                'code' => 'LOW_INCOME_AFFORDABILITY_RISK',

                'title' => 'Low-income household risk',

                'message' => 'The proposed tariff places the configured low-income household burden in the HIGH range.',

                'ai_action' => 'Suggest a targeted subsidy or lifeline tariff scenario and explain the trade-off.',
            ];
        }

        if (
            $tariffChangePct !== null &&
            $tariffChangePct >= 25
        ) {
            $alerts[] = [
                'severity' => 'warning',

                'code' => 'TARIFF_SHOCK',

                'title' => 'Large tariff change',

                'message' => 'The proposed tariff is at least 25% above the current configured tariff.',

                'ai_action' => 'Explain the affordability impact and suggest a phased tariff scenario.',
            ];
        }

        foreach (
            $sectorSatisfaction as $sector => $pct
        ) {
            if ($pct < 70) {
                $alerts[] = [
                    'severity' => 'warning',

                    'code' => 'SECTOR_STRESS_'.
                        strtoupper($sector),

                    'title' => ucfirst(
                        str_replace(
                            '_',
                            ' ',
                            $sector
                        )
                    ).
                        ' is under-supplied',

                    'message' => 'Calculated satisfaction is below 70% after the demand-response assumption is applied.',

                    'ai_action' => 'Explain the opportunity cost of changing this sector allocation.',
                ];
            }
        }

        if (count($alerts) === 0) {
            $alerts[] = [
                'severity' => 'advisory',

                'code' => 'SYSTEM_STABLE',

                'title' => 'No major rule-based alert',

                'message' => 'Current configured values do not trigger a major alert.',

                'ai_action' => 'Suggest a useful scenario to test next.',
            ];
        }

        return $alerts;
    }
}
