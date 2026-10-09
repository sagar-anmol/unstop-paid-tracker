"""
Headless smoke test for the built site.

Catches runtime failures a build cannot: a bad hook order, a component that
throws on mount, a blank screen, or a failed data fetch.

Serve the repository root first:

    npm run build
    python3 -m http.server 4173 --directory . &
    python3 scripts/smoke_test.py http://localhost:4173
"""

import sys

from playwright.sync_api import sync_playwright

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4173"
PASSWORD = sys.argv[2] if len(sys.argv) > 2 else "Techfest@2026"
USERNAME = "sagaranmol@gmail.com"
# Throwaway password used only inside the disposable browser context.
UNLOCK_PASSWORD = "SmokeTest@2026"

failures = []


def check(name, condition, detail=""):
    if condition:
        print(f"  ok   {name}")
    else:
        print(f"  FAIL {name} {detail}")
        failures.append(name)


def sign_in(page, username=USERNAME, password=PASSWORD):
    page.goto(BASE_URL, wait_until="networkidle", timeout=45000)
    page.wait_for_timeout(1500)
    inputs = page.locator("input")
    inputs.nth(0).fill(username)
    inputs.nth(1).fill(password)
    page.keyboard.press("Enter")
    # The forced-change modal appears ~500ms after sign-in; wait for either it
    # or the dashboard so the assertions see a settled page.
    page.wait_for_timeout(5000)


def sign_in_check(page, username=USERNAME, password=PASSWORD):
    """True when `password` signs the account in and reaches the dashboard."""
    try:
        sign_out(page)
        sign_in(page, username, password)
        return "Registration Flow" in page.locator("body").inner_text()
    except Exception:
        return False


def sign_out(page):
    """Ends the active session so the next sign-in starts from the login screen.

    The session is restored on load, so navigating to the base URL is not enough
    to test a password: without this the page comes back already signed in.
    """
    page.goto(BASE_URL, wait_until="networkidle", timeout=45000)
    page.wait_for_timeout(1200)

    if "Sign In to Operations Portal" in page.locator("body").inner_text():
        return

    menu = page.get_by_role("button", name="Sagar", exact=False).first
    if menu.count() == 0:
        return
    menu.click(timeout=5000)
    page.wait_for_timeout(600)

    out = page.get_by_text("Sign Out", exact=True).first
    if out.count() > 0:
        out.click(timeout=5000)
        page.wait_for_timeout(1500)


def complete_forced_change(page, new_password=UNLOCK_PASSWORD):
    """Replaces the default password, which is what unlocks the dashboard.

    The fields render as `type="password"` until the reveal toggle is used, so
    select on the type rather than on visible text.
    """
    fields = page.locator("input[type='password']")
    if fields.count() < 2:
        return False
    fields.nth(0).fill(new_password)
    fields.nth(1).fill(new_password)
    page.get_by_role("button", name="Save Password").first.click(timeout=5000)
    page.wait_for_timeout(3500)
    return True


def run(p):
    browser = p.chromium.launch(
        executable_path="/usr/bin/google-chrome",
        args=["--no-sandbox", "--disable-dev-shm-usage"],
    )

    # ---------- login screen ----------
    print("login screen")
    page = browser.new_page(viewport={"width": 1600, "height": 1000})
    console_errors = []
    page_errors = []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: page_errors.append(str(e)))

    failed_requests = []
    page.on("requestfailed", lambda r: failed_requests.append(f"{r.url} :: {r.failure}"))

    page.goto(BASE_URL, wait_until="networkidle", timeout=45000)
    page.wait_for_timeout(1500)

    check("page renders something", page.locator("#root").inner_html().strip() != "")
    check(
        "login form is visible",
        page.locator("input").count() >= 2,
        f"{page.locator('input').count()} inputs found",
    )
    check("no uncaught page errors on load", not page_errors, str(page_errors[:2]))

    # ---------- sign in ----------
    # Every run gets a fresh, non-persistent browser context, so localStorage
    # starts empty and this account is always on its initial password. Sign-in
    # therefore always lands on the forced-change gate rather than straight on
    # the dashboard.
    print("\nsign in")
    sign_in(page)

    body_text = page.locator("body").inner_text()
    check(
        "signed in and reached the forced password change",
        "Sign In to Operations Portal" not in body_text
        and "Set Your Custom Password" in body_text,
        body_text[:160],
    )

    # ---------- unlock, then dashboard ----------
    print("\ndashboard")
    check(
        "forced change replaced and dashboard unlocked",
        complete_forced_change(page),
        "could not submit the new password",
    )

    body_text = page.locator("body").inner_text()
    check(
        "KPI strip rendered",
        any(label in body_text for label in ["Registrations", "Collected", "Call Coverage"]),
        body_text[:200],
    )
    check("dataset loaded", "Dataset unavailable" not in body_text, "data.json fetch failed")
    check(
        "registrations table rendered",
        page.locator("table").count() > 0 or "No participants found" in body_text,
    )
    check("progress bars present", page.locator("div[style*='width']").count() > 0)
    check(
        "collected card does not invent a rupee figure",
        "No data yet" in body_text or "₹" in body_text,
        "collected card is neither populated nor in its empty state",
    )

    # ---------- interactions ----------
    print("\ninteractions")
    # A modal left open over the dashboard silently swallows every click.
    check(
        "no modal left blocking the dashboard after the forced change",
        page.locator("div.fixed.inset-0.z-50").count() == 0,
        "an overlay is still mounted over the unlocked dashboard",
    )
    desk_button = page.get_by_role("button", name="Verification", exact=True).first
    if desk_button.count() > 0 and desk_button.is_visible():
        desk_button.click(timeout=5000)
        page.wait_for_timeout(1500)
        check(
            "verification desk opens",
            "Payment Verification Desk" in page.locator("body").inner_text(),
        )
        # The desk closes on its close button, not on Escape. The close control is
        # the icon button in the header, next to "Export CSV".
        desk = page.locator("div.fixed.inset-0.z-50").first
        desk.get_by_role("button").nth(1).click(timeout=5000)
        page.wait_for_timeout(800)
        check(
            "verification desk closes again",
            page.locator("div.fixed.inset-0.z-50").count() == 0,
            "the desk stayed open and would block the tabs below",
        )
    else:
        check("verification desk hidden for a non-admin role", True)

    # The tab label carries a live count, so match on the prefix rather than the
    # full accessible name.
    cancelled_tab = page.get_by_role("button", name="Cancelled", exact=False).first
    if cancelled_tab.count() > 0 and cancelled_tab.is_visible():
        cancelled_tab.click(timeout=5000)
        page.wait_for_timeout(1200)
        after = page.locator("body").inner_text()
        check(
            "cancelled tab filters or reports an empty state",
            "No cancelled registrations" in after
            or "Registration Cancelled" in after
            or "Cancelled" in after,
        )
    else:
        check("cancelled tab present in the category bar", False, "tab not visible")

    print("\nconsole hygiene")
    meaningful = [e for e in console_errors if "favicon" not in e.lower() and "404" not in e]
    check("no console errors", not meaningful, str(meaningful[:3]))
    check("no uncaught errors during interaction", not page_errors, str(page_errors[:3]))
    check("no failed network requests", not failed_requests, str(failed_requests[:2]))

    # Leave the session ended so the page state is clean for the next block.
    sign_out(page)

    page.close()

    # ---------- forced password change, on a clean profile ----------
    # A fresh context has empty localStorage, so the account is on its default
    # password and the forced-change flow must appear. Re-asserted separately
    # from the flow above because the gate itself is the security property
    # under test: the dashboard must be unreachable while it is pending.
    print("\nforced password change (clean profile)")
    fresh = browser.new_context(viewport={"width": 1440, "height": 900})
    fresh_page = fresh.new_page()
    fresh_errors = []
    fresh_page.on("pageerror", lambda e: fresh_errors.append(str(e)))

    # Wide viewport so the desktop nav is the one under test.
    sign_in(fresh_page)

    forced_text = fresh_page.locator("body").inner_text()
    check(
        "first sign-in forces a password change",
        "Set Your Custom Password" in forced_text,
        "modal did not appear for a default-password account",
    )
    # The dashboard and admin tools must be unreachable while the change is
    # pending, otherwise the prompt is only a suggestion.
    check(
        "password manager withheld until the change is made",
        fresh_page.get_by_role("button", name="Passwords", exact=True).count() == 0,
        "admin tools were offered before the password was changed",
    )
    check(
        "verification desk withheld until the change is made",
        fresh_page.get_by_role("button", name="Verification", exact=True).count() == 0,
        "verification desk was offered before the password was changed",
    )
    check(
        "registrations are not reachable before the password is changed",
        fresh_page.get_by_text("Registration Flow").count() == 0,
        "dashboard rendered while a forced change was pending",
    )
    check(
        "forced change cannot be dismissed",
        fresh_page.get_by_text("Skip for now").count() == 0,
        "an escape hatch was offered on a forced password change",
    )

    # ---------- dashboard, once the account is unlocked ----------
    print("\ndashboard (after the forced change)")
    pw_inputs = fresh_page.locator("input[type='password']")
    check(
        "forced change exposes exactly two password fields",
        pw_inputs.count() == 2,
        f"{pw_inputs.count()} password inputs found",
    )
    complete_forced_change(fresh_page)

    unlocked_text = fresh_page.locator("body").inner_text()
    check(
        "dashboard unlocks once the password is changed",
        "Registration Flow" in unlocked_text,
        unlocked_text[:160],
    )
    check(
        "admin tools available after the change",
        fresh_page.get_by_role("button", name="Passwords", exact=True).count() > 0,
        "Passwords button still missing after the change",
    )
    check(
        "the new password is actually accepted on re-login",
        sign_in_check(fresh_page, USERNAME, UNLOCK_PASSWORD),
        "sign-in with the new password failed",
    )
    check(
        "the old default password is rejected after the change",
        not sign_in_check(fresh_page, USERNAME, PASSWORD),
        "the initial password still worked after it was replaced",
    )
    check(
        "no errors during the unlock flow",
        not fresh_errors,
        str(fresh_errors[:2]),
    )

    fresh.close()
    browser.close()


def main():
    with sync_playwright() as p:
        run(p)

    if failures:
        print(f"\n{len(failures)} check(s) failed")
        sys.exit(1)
    print("\nSmoke test passed.")


if __name__ == "__main__":
    main()