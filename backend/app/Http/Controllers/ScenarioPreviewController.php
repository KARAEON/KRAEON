<?php

namespace App\Http\Controllers;

use App\Models\WaterEconomyBarangay;
use App\Services\WaterEconomyCalculator;
use Illuminate\Http\Request;

class ScenarioPreviewController extends Controller
{
    public function preview(
        Request $request,
        string $psgcCode,
        WaterEconomyCalculator $calculator
    ) {
        $validated = $request->validate([
            'changes' =>
                'required|array|min:1',

            'changes.nrw_rate_pct' =>
                'sometimes|numeric|min:0|max:100',

            'changes.gross_supply_m3_day' =>
                'sometimes|numeric|min:0',

            'changes.proposed_tariff_php_m3' =>
                'sometimes|numeric|min:0',

            'changes.demand_response_pct' =>
                'sometimes|numeric|min:-100|max:100',

            'changes.household_allocated_m3_day' =>
                'sometimes|numeric|min:0',

            'changes.critical_services_allocated_m3_day' =>
                'sometimes|numeric|min:0',

            'changes.agriculture_allocated_m3_day' =>
                'sometimes|numeric|min:0',

            'changes.fisheries_allocated_m3_day' =>
                'sometimes|numeric|min:0',

            'changes.aquaculture_allocated_m3_day' =>
                'sometimes|numeric|min:0',

            'changes.business_allocated_m3_day' =>
                'sometimes|numeric|min:0',

            'changes.industry_allocated_m3_day' =>
                'sometimes|numeric|min:0',
        ]);

        $original =
            WaterEconomyBarangay::where(
                'psgc_code',
                $psgcCode
            )->firstOrFail();

        /*
        |--------------------------------------------------------------------------
        | IMPORTANT: CLONE ONLY
        |--------------------------------------------------------------------------
        | This never saves to the database.
        */

        $preview =
            $original->replicate();

        $preview->exists = true;
        $preview->setAttribute(
            'id',
            $original->id
        );

        foreach (
            $validated['changes']
            as $key => $value
        ) {
            $preview->setAttribute(
                $key,
                $value
            );
        }

        $before =
            $calculator->calculate(
                $original
            );

        $after =
            $calculator->calculate(
                $preview
            );

        return response()->json([
            'status' =>
                'PREVIEW ONLY',

            'saved' =>
                false,

            'changes' =>
                $validated['changes'],

            'before' =>
                $this->compact($before),

            'after' =>
                $this->compact($after),

            'note' =>
                'The suggestion was calculated in memory only. No database values were changed.',
        ]);
    }

    private function compact(
        array $state
    ): array {
        return [
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

            'source_pressure_pct' =>
                data_get(
                    $state,
                    'water.source_pressure_pct'
                ),

            'nrw_rate_pct' =>
                data_get(
                    $state,
                    'water.nrw_rate_pct'
                ),

            'affordability_class' =>
                data_get(
                    $state,
                    'affordability.affordability_class'
                ),

            'proposed_water_burden_pct' =>
                data_get(
                    $state,
                    'affordability.proposed_water_burden_pct'
                ),

            'sector_satisfaction_pct' =>
                data_get(
                    $state,
                    'sector_satisfaction_pct',
                    []
                ),
        ];
    }
}
