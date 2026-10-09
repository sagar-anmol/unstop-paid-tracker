"""Dump the rendered dashboard so failures can be inspected rather than guessed."""

import sys

from playwright.sync_api import sync_playwright

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4173"
PASSWORD = sys.argv[2] if len(sys.argv) > 2 else "Techfest@2026"

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path="/usr/bin/google-chrome",
        args=["--no-sandbox", "--disable-dev-shm-usage"],
    )
    page = browser.new_page(viewport={"width": 1600, "height": 1000})
    page.goto(BASE_URL, wait_until="networkidle", timeout=45000)
    page.wait_for_timeout(1500)

    inputs = page.locator("input")
    inputs.nth(0).fill("sagaranmol@gmail.com")
    inputs.nth(1).fill(PASSWORD)
    page.keyboard.press("Enter")
    page.wait_for_timeout(5000)

    print("=" * 70)
    print(page.locator("body").inner_text()[:3000])
    print("=" * 70)

    buttons = page.locator("button")
    print(f"\nbuttons ({buttons.count()}):")
    for i in range(min(buttons.count(), 40)):
        try:
            label = buttons.nth(i).inner_text().strip().replace("\n", " ")
            visible = buttons.nth(i).is_visible()
            if label and visible:
                print(f"  [{i}] {label[:60]}")
        except Exception:
            pass

    print("\nverification desk button candidates:")
    for i in range(buttons.count()):
        try:
            label = buttons.nth(i).inner_text().strip().replace("\n", " ")
            if "erification" in label:
                print(
                    f"  [{i}] text={label[:50]!r} visible={buttons.nth(i).is_visible()} "
                    f"enabled={buttons.nth(i).is_enabled()}"
                )
        except Exception:
            pass

    browser.close()