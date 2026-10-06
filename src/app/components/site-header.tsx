import { auth } from "@/server/auth";
import { signOutAction } from "@/server/actions/auth";

export async function SiteHeader() {
  const session = await auth();
  const user =
    session?.user?.id && session.user.displayName ? session.user : null;

  return (
    <header className="wrap header">
      <a className="wordmark" href="/">
        Easy Exchange
      </a>
      <nav className="nav" aria-label="Main">
        <a href="/mine">My listings</a>
        {user ? (
          <>
            <a href="/listings/new">List an item</a>
            <a href="/offers/incoming">Incoming</a>
            <a href="/offers">Offers</a>
            <span className="who">{user.displayName}</span>
            <form action={signOutAction}>
              <button className="text-button" type="submit">
                Sign out
              </button>
            </form>
          </>
        ) : (
          <>
            <a href="/sign-in">Sign in</a>
            <a href="/sign-up">Create account</a>
          </>
        )}
      </nav>
    </header>
  );
}
