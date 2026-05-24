import asyncio
import os
from dotenv import load_dotenv
from services.crosscheck import crosscheck

async def main():
    load_dotenv()
    res = await crosscheck("NASA discovered water ice on Mars surface")
    print(res)

if __name__ == "__main__":
    asyncio.run(main())
