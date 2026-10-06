<?php

namespace App\Http\Controllers;

use App\Models\WaterEconomyBarangay;
use App\Services\WaterEconomyCalculator;
use Illuminate\Http\Request;

class WaterEconomyController extends Controller
{
    public function index(Request $request)
    {
        $query = WaterEconomyBarangay::query()
            ->orderBy('lgu')
            ->orderBy('barangay');

        if ($request->filled('lgu')) {
            $query->where(
                'lgu',
                $request->string('lgu')
            );
        }

        return response()->json(
            $query->get([
                'psgc_code',
                'lgu',
                'barangay',
                'urban_rural',
                'population_2024',
                'avg_household_size',
                'gross_supply_m3_day',
                'source_capacity_m3_day',
                'nrw_rate_pct',
                'reserve_rate_pct',
                'avg_household_income_php',
                'monthly_water_cost_php',
                'piped_access_pct',
                'supply_reliability_pct',
                'household_demand_m3_day',
                'critical_services_demand_m3_day',
                'agriculture_demand_m3_day',
                'fisheries_demand_m3_day',
                'aquaculture_demand_m3_day',
                'business_demand_m3_day',
                'industry_demand_m3_day',
                'household_allocated_m3_day',
                'critical_services_allocated_m3_day',
                'agriculture_allocated_m3_day',
                'fisheries_allocated_m3_day',
                'aquaculture_allocated_m3_day',
                'business_allocated_m3_day',
                'industry_allocated_m3_day',
                'data_version',
                'updated_at',
            ])
        );
    }

    public function show(
        string $psgcCode,
        WaterEconomyCalculator $calculator
    ) {
        $barangay =
            WaterEconomyBarangay::where(
                'psgc_code',
                $psgcCode
            )->firstOrFail();

        return response()->json([
            'record' => $barangay,
            'calculated' =>
                $calculator->calculate($barangay),
        ]);
    }

    public function update(
        Request $request,
        string $psgcCode,
        WaterEconomyCalculator $calculator
    ) {
        $barangay =
            WaterEconomyBarangay::where(
                'psgc_code',
                $psgcCode
            )->firstOrFail();

        $validated = $request->validate([
            'gross_supply_m3_day' =>
                'sometimes|numeric|min:0',
                
            'allocable_water_m3_day' =>
    'sometimes|numeric|min:0',

            'source_capacity_m3_day' =>
                'sometimes|numeric|min:0',

            'nrw_rate_pct' =>
                'sometimes|numeric|min:0|max:100',

            'reserve_rate_pct' =>
                'sometimes|numeric|min:0|max:100',

            /*
            |--------------------------------------------------------------------------
            | TARIFF + AFFORDABILITY
            |--------------------------------------------------------------------------
            */

            'tariff_php_m3' =>
                'sometimes|numeric|min:0',

            'monthly_consumption_m3' =>
                'sometimes|numeric|min:0',

            'proposed_tariff_php_m3' =>
                'sometimes|numeric|min:0',

            'demand_response_pct' =>
                'sometimes|numeric|min:-100|max:100',

            'avg_household_income_php' =>
                'sometimes|numeric|min:0',

            'low_income_monthly_income_php' =>
                'sometimes|numeric|min:0',

            'affordability_low_threshold_pct' =>
                'sometimes|numeric|min:0|max:100',

            'affordability_high_threshold_pct' =>
                'sometimes|numeric|min:0|max:100',

            'monthly_water_cost_php' =>
                'sometimes|numeric|min:0',

            'piped_access_pct' =>
                'sometimes|numeric|min:0|max:100',

            'supply_reliability_pct' =>
                'sometimes|numeric|min:0|max:100',

            'livelihood_profile' =>
                'sometimes|nullable|string|max:255',

            /*
            |--------------------------------------------------------------------------
            | DEMANDS
            |--------------------------------------------------------------------------
            */

            'household_demand_m3_day' =>
                'sometimes|numeric|min:0',

            'critical_services_demand_m3_day' =>
                'sometimes|numeric|min:0',

            'agriculture_demand_m3_day' =>
                'sometimes|numeric|min:0',

            'fisheries_demand_m3_day' =>
                'sometimes|numeric|min:0',

            'aquaculture_demand_m3_day' =>
                'sometimes|numeric|min:0',

            'business_demand_m3_day' =>
                'sometimes|numeric|min:0',

            'industry_demand_m3_day' =>
                'sometimes|numeric|min:0',

            /*
            |--------------------------------------------------------------------------
            | ALLOCATIONS
            |--------------------------------------------------------------------------
            */

            'household_allocated_m3_day' =>
                'sometimes|numeric|min:0',

            'critical_services_allocated_m3_day' =>
                'sometimes|numeric|min:0',

            'agriculture_allocated_m3_day' =>
                'sometimes|numeric|min:0',

            'fisheries_allocated_m3_day' =>
                'sometimes|numeric|min:0',

            'aquaculture_allocated_m3_day' =>
                'sometimes|numeric|min:0',

            'business_allocated_m3_day' =>
                'sometimes|numeric|min:0',

            'industry_allocated_m3_day' =>
                'sometimes|numeric|min:0',
        ]);

        /*
        | Threshold validation:
        | High threshold should not be below low threshold.
        */

        $newLow = array_key_exists(
            'affordability_low_threshold_pct',
            $validated
        )
            ? (float) $validated[
                'affordability_low_threshold_pct'
            ]
            : (float) $barangay
                ->affordability_low_threshold_pct;

        $newHigh = array_key_exists(
            'affordability_high_threshold_pct',
            $validated
        )
            ? (float) $validated[
                'affordability_high_threshold_pct'
            ]
            : (float) $barangay
                ->affordability_high_threshold_pct;

        if ($newHigh < $newLow) {
            return response()->json([
                'message' =>
                    'High affordability threshold must be greater than or equal to the low threshold.',
            ], 422);
        }

        $barangay->fill($validated);

        $barangay->data_version =
            $barangay->data_version + 1;

        $barangay->save();
        $barangay->refresh();

        return response()->json([
            'message' =>
                'Water economy data updated.',

            'record' =>
                $barangay,

            'calculated' =>
                $calculator->calculate($barangay),
        ]);
    }

    public function state(
        string $psgcCode,
        WaterEconomyCalculator $calculator
    ) {
        $barangay =
            WaterEconomyBarangay::where(
                'psgc_code',
                $psgcCode
            )->firstOrFail();

        return response()->json(
            $calculator->calculate($barangay)
        );
    }
}
