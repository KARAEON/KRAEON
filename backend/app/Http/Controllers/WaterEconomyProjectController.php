<?php

namespace App\Http\Controllers;

use App\Models\WaterEconomyBarangay;
use App\Models\WaterEconomyProject;
use Illuminate\Http\Request;

class WaterEconomyProjectController extends Controller
{
    public function index(string $psgcCode)
    {
        WaterEconomyBarangay::where(
            'psgc_code',
            $psgcCode
        )->firstOrFail();

        $projects = WaterEconomyProject::where(
            'psgc_code',
            $psgcCode
        )
            ->orderByDesc('updated_at')
            ->get();

        return response()->json([
            'projects' => $projects,
        ]);
    }

    public function store(
        Request $request,
        string $psgcCode
    ) {
        WaterEconomyBarangay::where(
            'psgc_code',
            $psgcCode
        )->firstOrFail();

        $validated = $this->validateProject(
            $request
        );

        $project = WaterEconomyProject::create([
            ...$validated,
            'psgc_code' => $psgcCode,
        ]);

        return response()->json([
            'message' =>
                'Intervention saved.',

            'project' =>
                $project,
        ], 201);
    }

    public function update(
        Request $request,
        string $psgcCode,
        WaterEconomyProject $project
    ) {
        if (
            $project->psgc_code !==
            $psgcCode
        ) {
            abort(404);
        }

        $validated = $this->validateProject(
            $request
        );

        $project->fill($validated);
        $project->save();
        $project->refresh();

        return response()->json([
            'message' =>
                'Intervention updated.',

            'project' =>
                $project,
        ]);
    }

    public function destroy(
        string $psgcCode,
        WaterEconomyProject $project
    ) {
        if (
            $project->psgc_code !==
            $psgcCode
        ) {
            abort(404);
        }

        $project->delete();

        return response()->json([
            'message' =>
                'Intervention deleted.',
        ]);
    }

    private function validateProject(
        Request $request
    ): array {
        return $request->validate([
            'project_type' =>
                'required|string|max:80',

            'name' =>
                'required|string|max:160',

            'capex_php' =>
                'required|numeric|min:0',

            'annual_opex_php' =>
                'required|numeric|min:0',

            'useful_life_years' =>
                'required|integer|min:1|max:100',

            'water_gain_m3_per_day' =>
                'required|numeric|min:0',

            'households_benefited' =>
                'required|integer|min:0',

            'reliability_score' =>
                'required|numeric|min:0|max:100',

            'equity_score' =>
                'required|numeric|min:0|max:100',

            'economic_benefit_score' =>
                'required|numeric|min:0|max:100',

            'implementation_time_months' =>
                'required|integer|min:1|max:600',
        ]);
    }
}
