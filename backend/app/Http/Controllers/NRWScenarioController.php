<?php

namespace App\Http\Controllers;

use App\Models\WaterEconomyBarangay;
use App\Services\NRWScenarioCalculator;
use Illuminate\Http\Request;

class NRWScenarioController extends Controller
{
    public function show(
        string $psgcCode,
        NRWScenarioCalculator $calculator
    ) {
        $barangay =
            WaterEconomyBarangay::where(
                'psgc_code',
                $psgcCode
            )->firstOrFail();

        return response()->json([
            'record' => $barangay,
            'nrw' => $calculator->calculate($barangay),
        ]);
    }

    public function update(
        Request $request,
        string $psgcCode,
        NRWScenarioCalculator $calculator
    ) {
        $validated = $request->validate([
            'allocable_water_m3_day' =>
                'required|numeric|min:0',

            'proposed_nrw_rate_pct' =>
                'required|numeric|min:0|max:100',
        ]);

        $barangay =
            WaterEconomyBarangay::where(
                'psgc_code',
                $psgcCode
            )->firstOrFail();

        /*
        | User edits allocable water and proposed NRW only.
        | Loss is NEVER manually entered.
        */

        $barangay->allocable_water_m3_day =
            $validated['allocable_water_m3_day'];

        $barangay->proposed_nrw_rate_pct =
            $validated['proposed_nrw_rate_pct'];

        $barangay->data_version =
            ((int) $barangay->data_version) + 1;

        $barangay->save();
        $barangay->refresh();

        return response()->json([
            'message' =>
                'NRW scenario saved and recalculated.',

            'record' =>
                $barangay,

            'nrw' =>
                $calculator->calculate($barangay),
        ]);
    }
}
