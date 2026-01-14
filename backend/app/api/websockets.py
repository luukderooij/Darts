import asyncio
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.logging_config import log_buffer

router = APIRouter()
logger = logging.getLogger("dart_app")

@router.websocket("/logs")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    # 1. Send existing logs immediately upon connection
    # Convert deque to list so it is JSON serializable
    await websocket.send_json(list(log_buffer))
    
    try:
        while True:
            # 2. Wait a bit (Poll)
            # In a production app, we would use an event trigger, 
            # but polling the buffer every 2 seconds is fine for this.
            await asyncio.sleep(2)
            
            # Send the current buffer state
            await websocket.send_json(list(log_buffer))
            
    except WebSocketDisconnect:
        logger.info("Logs Client disconnected")