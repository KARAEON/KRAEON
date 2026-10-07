<?php

namespace App\Http\Controllers;

use App\Models\WaterEconomyBarangay;
use App\Models\WaterEconomyProject;
use App\Services\InterventionValuationService;
use App\Services\PublicBenefitPerPesoService;
use Illuminate\Http\Request;

class PublicBenefitPerPesoController extends Controller
{
    public function preview(
        Request $request,
        string $psgcCode,
        PublicBenefitPerPesoService $benefitService,
        InterventionValuationService $valuationService
    ) {
        WaterEconomyBarangay::where('psgc_code', $psgcCode)->firstOrFail();
        $validated = $request->validate([
            'projects' => 'required|array|max:12',
            'projects.*.project_type' => 'required|string|max:80',
            'projects.*.name' => 'required|string|max:160',
            'projects.*.capex_php' => 'required|numeric|min:0',
            'projects.*.annual_opex_php' => 'required|numeric|min:0',
            'projects.*.useful_life_years' => 'required|integer|min:1|max:100',
            'projects.*.water_gain_m3_per_day' => 'required|numeric|min:0',
            'projects.*.households_benefited' => 'required|integer|min:0',
            'projects.*.reliability_score' => 'required|numeric|min:0|max:100',
            'projects.*.equity_score' => 'required|numeric|min:0|max:100',
            'projects.*.economic_benefit_score' => 'required|numeric|min:0|max:100',
            'projects.*.implementation_time_months' => 'required|integer|min:1|max:600',
            'weights.water' => 'sometimes|numeric|min:0',
            'weights.equity' => 'sometimes|numeric|min:0',
            'weights.economic' => 'sometimes|numeric|min:0',
            'weights.reliability' => 'sometimes|numeric|min:0',
            'weights.cost_efficiency' => 'sometimes|numeric|min:0',
        ]);
        $saved = WaterEconomyProject::where('psgc_code', $psgcCode)->get();
        $drafts = collect($validated['projects'])->map(function (array $data) use ($psgcCode) {
            return new WaterEconomyProject([...$data, 'psgc_code' => $psgcCode]);
        });
        $result = $benefitService->rank(
            $saved->concat($drafts),
            $valuationService,
            $validated['weights'] ?? PublicBenefitPerPesoService::DEFAULT_WEIGHTS
        );
        foreach ($result['ranking'] as &$row) {
            $row['is_draft'] = $row['project_id'] === null;
        }
        unset($row);
        return response()->json(['saved' => false, ...$result]);
    }

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
