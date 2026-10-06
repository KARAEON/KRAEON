<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('water_economy_barangays', function (Blueprint $table) {
            $table->decimal('allocable_water_m3_day', 14, 2)
                ->nullable()
                ->after('gross_supply_m3_day');
        });

        // Initialize the new field from the existing gross supply
        // so old barangay records continue to work immediately.
        DB::table('water_economy_barangays')
            ->whereNull('allocable_water_m3_day')
            ->update([
                'allocable_water_m3_day' =>
                    DB::raw('gross_supply_m3_day')
            ]);
    }

    public function down(): void
    {
        Schema::table('water_economy_barangays', function (Blueprint $table) {
            $table->dropColumn('allocable_water_m3_day');
        });
    }
};
