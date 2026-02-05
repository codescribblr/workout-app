import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify the plan belongs to the user
    const { data: plan, error: planError } = await supabase
      .from("workout_plans")
      .select("id")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { error: "Workout plan not found" },
        { status: 404 }
      );
    }

    // Delete the plan (exercises will be deleted via CASCADE)
    const { data: deletedData, error: deleteError } = await supabase
      .from("workout_plans")
      .delete()
      .eq("id", params.id)
      .eq("user_id", user.id)
      .select();

    if (deleteError) {
      console.error("Error deleting workout plan:", deleteError);
      return NextResponse.json(
        { 
          error: "Failed to delete workout plan",
          details: deleteError.message 
        },
        { status: 500 }
      );
    }

    // Check if anything was actually deleted
    if (!deletedData || deletedData.length === 0) {
      console.error("No rows deleted - possible RLS policy issue");
      return NextResponse.json(
        { 
          error: "Failed to delete workout plan. Please ensure you have permission to delete this plan.",
          details: "No rows were deleted. This may be due to missing RLS policy."
        },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, deleted: deletedData });
  } catch (error: any) {
    console.error("Error deleting workout plan:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
