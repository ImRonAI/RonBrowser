
import asyncio
from playwright.async_api import async_playwright
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("debug_browser")

async def main():
    cdp_url = "http://localhost:9222"
    logger.info(f"Connecting to CDP at {cdp_url}...")
    
    async with async_playwright() as p:
        try:
            browser = await p.chromium.connect_over_cdp(cdp_url)
            logger.info(f"Connected! Browser Connected: {browser.is_connected()}")
            
            logger.info(f"Contexts found: {len(browser.contexts)}")
            
            for i, context in enumerate(browser.contexts):
                logger.info(f"--- Context {i} ---")
                logger.info(f"Pages in context: {len(context.pages)}")
                
                for j, page in enumerate(context.pages):
                    try:
                        title = await page.title()
                        url = page.url
                        logger.info(f"  Page {j}: Title='{title}', URL='{url}'")
                        
                        # Test for window.electron
                        try:
                            has_electron = await page.evaluate("!!window.electron")
                            logger.info(f"    window.electron present: {has_electron}")
                            if has_electron:
                                keys = await page.evaluate("Object.keys(window.electron)")
                                logger.info(f"    keys: {keys}")
                        except Exception as e:
                            logger.info(f"    Error checking window.electron: {e}")
                            
                    except Exception as e:
                        logger.info(f"  Error inspecting page {j}: {e}")
                        
        except Exception as e:
            logger.error(f"Failed to connect: {e}")

if __name__ == "__main__":
    asyncio.run(main())
