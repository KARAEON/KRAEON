<?php

namespace App\Http\Controllers;

use App\Models\WaterEconomyBarangay;
use App\Models\WaterEconomyProject;
use App\Services\InterventionValuationService;

class InterventionValuationController extends Controller
{
    public function index(
        string $psgcCode,
        InterventionValuationService $valuation
    ) {
        $barangay =
            WaterEconomyBarangay::where(
                'psgc_code',
                $psgcCode
            )->firstOrFail();

        $projects =
            WaterEconomyProject::where(
                'psgc_code',
                $psgcCode
            )
                ->orderByDesc(
                    'updated_at'
                )
                ->get();

        return response()->json([
            'barangay' => [
                'psgc_code' =>
                    $barangay->psgc_code,

                'barangay' =>
                    $barangay->barangay,

                'lgu' =>
                    $barangay->lgu,
            ],

            'valuations' =>
                $valuation
                    ->valueCollection(
                        $projects
                    ),

            'count' =>
                $projects->count(),

            'method_note' =>
                'This is a simple lifecycle valuation for hackathon decision support. It is not a discounted NPV appraisal.',
        ]);
    }

    public function show(
        string $psgcCode,
        WaterEconomyProject $project,
        InterventionValuationService $valuation
    ) {
        if (
            $project->psgc_code !==
            $psgcCode
        ) {
            abort(404);
        }

        return response()->json([
            'valuation' =>
                $valuation
                    ->valueProject(
                        $project
                    ),
        ]);
    }
}
