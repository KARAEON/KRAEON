<?php

namespace App\Services;

use App\Models\WaterEconomyProject;

class InterventionValuationService
{
    public function valueProject(
        WaterEconomyProject $project
    ): array {
        $capex = max(
            0,
            (float) $project->capex_php
        );

        $annualOpex = max(
            0,
            (float) $project->annual_opex_php
        );

        $lifeYears = max(
            1,
            (int) $project->useful_life_years
        );

        $waterGainPerDay = max(
            0,
            (float) $project->water_gain_m3_per_day
        );

        $households = max(
            0,
            (int) $project->households_benefited
        );

        /*
        |--------------------------------------------------------------------------
        | NO. 14 — INTERVENTION ECONOMIC VALUATION
        |--------------------------------------------------------------------------
        |
        | A. Simple lifecycle cost
        | Lifecycle Cost = CAPEX + (Annual OPEX × Useful Life)
        |
        */

        $lifecycleCost =
            $capex +
            (
                $annualOpex *
                $lifeYears
            );

        /*
        |--------------------------------------------------------------------------
        | B. Lifetime Water
        |--------------------------------------------------------------------------
        |
        | Lifetime Water =
        | Water Gain Per Day × 365 × Useful Life
        |
        */

        $lifetimeWater =
            $waterGainPerDay *
            365 *
            $lifeYears;

        /*
        |--------------------------------------------------------------------------
        | Simple Lifecycle Cost per m3
        |--------------------------------------------------------------------------
        */

        $costPerM3 =
            $lifetimeWater > 0
                ? $lifecycleCost /
                    $lifetimeWater
                : null;

        /*
        |--------------------------------------------------------------------------
        | C. CAPEX per beneficiary household
        |--------------------------------------------------------------------------
        */

        $capexPerHousehold =
            $households > 0
                ? $capex /
                    $households
                : null;

        /*
        |--------------------------------------------------------------------------
        | D. Economic loss avoided
        |--------------------------------------------------------------------------
        |
        | Do NOT invent a peso value.
        | A monetary value requires a defensible coefficient or model.
        |
        */

        return [
            'project_id' =>
                $project->id,

            'project_type' =>
                $project->project_type,

            'name' =>
                $project->name,

            'inputs' => [
                'capex_php' =>
                    round(
                        $capex,
                        2
                    ),

                'annual_opex_php' =>
                    round(
                        $annualOpex,
                        2
                    ),

                'useful_life_years' =>
                    $lifeYears,

                'water_gain_m3_per_day' =>
                    round(
                        $waterGainPerDay,
                        2
                    ),

                'households_benefited' =>
                    $households,
            ],

            'valuation' => [
                'simple_lifecycle_cost_php' =>
                    round(
                        $lifecycleCost,
                        2
                    ),

                'lifetime_water_m3' =>
                    round(
                        $lifetimeWater,
                        2
                    ),

                'simple_lifecycle_cost_per_m3_php' =>
                    $costPerM3 === null
                        ? null
                        : round(
                            $costPerM3,
                            4
                        ),

                'capex_per_household_php' =>
                    $capexPerHousehold === null
                        ? null
                        : round(
                            $capexPerHousehold,
                            2
                        ),

                'economic_loss_avoided_php_year' =>
                    null,

                'economic_loss_avoided_status' =>
                    'NOT CALCULATED',

                'economic_loss_avoided_note' =>
                    'No defensible monetary loss-avoidance coefficient is configured, so the system does not invent a peso value.',
            ],

            'labels' => [
                'lifecycle_cost' =>
                    'Simple lifecycle cost',

                'cost_per_m3' =>
                    'Simple lifecycle cost / m³',

                'capex_per_household' =>
                    'CAPEX per beneficiary household',
            ],
        ];
    }

    public function valueCollection(
        iterable $projects
    ): array {
        $results = [];

        foreach ($projects as $project) {
            $results[] =
                $this->valueProject(
                    $project
                );
        }

        return $results;
    }
}
