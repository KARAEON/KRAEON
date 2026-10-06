<?php

namespace App\Http\Controllers;

use App\Models\WaterEconomyBarangay;
use App\Models\WaterEconomyProject;
use App\Services\InterventionValuationService;
use App\Services\PublicBenefitPerPesoService;
use Illuminate\Http\Request;

class PublicBenefitPerPesoController extends Controller
{
    public function show(
        Request $request,
        string $psgcCode,
        PublicBenefitPerPesoService $benefitService,
        InterventionValuationService $valuationService
    ) {
        WaterEconomyBarangay::where(
            'psgc_code',
            $psgcCode
        )->firstOrFail();

        $validated = $request->validate([
            'water' =>
                'sometimes|numeric|min:0',

            'equity' =>
                'sometimes|numeric|min:0',

            'economic' =>
                'sometimes|numeric|min:0',

            'reliability' =>
                'sometimes|numeric|min:0',

            'cost_efficiency' =>
                'sometimes|numeric|min:0',
        ]);

        $weights = count($validated)
            ? $validated
            : PublicBenefitPerPesoService::DEFAULT_WEIGHTS;

        $projects = WaterEconomyProject::where(
            'psgc_code',
            $psgcCode
        )->get();

        return response()->json(
            $benefitService->rank(
                $projects,
                $valuationService,
                $weights
            )
        );
    }
}
