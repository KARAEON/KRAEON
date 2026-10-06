<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('water_economy_barangays', function (Blueprint $table) {
            $table->decimal('proposed_nrw_rate_pct', 6, 2)
                ->nullable()
                ->after('nrw_rate_pct');
        });
    }

    public function down(): void
    {
        Schema::table('water_economy_barangays', function (Blueprint $table) {
            $table->dropColumn('proposed_nrw_rate_pct');
        });
    }
};
