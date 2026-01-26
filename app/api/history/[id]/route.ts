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

    // Verify the session belongs to the user
    const { data: session, error: sessionError } = await supabase
      .from("workout_sessions")
      .select("id")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Workout session not found" },
        { status: 404 }
      );
    }

    // Delete the session (sets will be deleted via CASCADE)
    const { data: deletedData, error: deleteError } = await supabase
      .from("workout_sessions")
      .delete()
      .eq("id", params.id)
      .eq("user_id", user.id)
      .select();

    if (deleteError) {
      console.error("Error deleting workout session:", deleteError);
      return NextResponse.json(
        { 
          error: "Failed to delete workout session",
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
          error: "Failed to delete workout session. Please ensure you have permission to delete this session.",
          details: "No rows were deleted. This may be due to missing RLS policy."
        },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, deleted: deletedData });
  } catch (error: any) {
    console.error("Error deleting workout session:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete workout session" },
      { status: 500 }
    );
  }
}
