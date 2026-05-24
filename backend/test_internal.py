import asyncio
from routes.analyze import analyze
from pydantic import BaseModel

class AnalyzeRequest(BaseModel):
    url: str | None = None
    text: str | None = None
    authors: list[str] | None = None

async def test():
    req = AnalyzeRequest(text="Bill Gates admitted COVID-19 vaccines contain microchips")
    try:
        res = await analyze(req)
        print("Verdict:", res["verdict"])
        print("Score:", res["score"])
    except Exception as e:
        import traceback
        traceback.print_exc()

asyncio.run(test())
