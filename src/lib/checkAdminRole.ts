
import { auth } from "@/lib/firebase/config";

/**
 * Checks if the currently signed-in user has an 'admin' custom claim.
 * This is the most secure way to check for admin role on the client-side,
 * as custom claims are verified and included in the user's ID token by Firebase itself.
 *
 * @returns A promise that resolves to true if the user is an admin, otherwise false.
 */
export async function checkAdminRole(): Promise<boolean> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return false;
  }

  try {
    // Force a token refresh to get the latest custom claims.
    const idTokenResult = await currentUser.getIdTokenResult(true); 
    return idTokenResult.claims.admin === true;
  } catch (error) {
    console.error("Error checking admin role via custom claims:", error);
    return false;
  }
}
