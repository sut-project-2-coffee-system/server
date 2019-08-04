'use strict';

const functions = require('firebase-functions');
const { WebhookClient } = require('dialogflow-fulfillment');
const { Card, Suggestion } = require('dialogflow-fulfillment');
const request = require("request-promise");
const crypto = require('crypto');
const secret = '442856b88bad478ad8e2d4e54fdd20f2';




const LINE_MESSAGING_API = "https://api.line.me/v2/bot/message";
const LINE_HEADER = {
  "Content-Type": "application/json",
  "Authorization": "Bearer gEIeipovFZMLDya4PobyyeLzJiH98XBs6q7fxyhCnUR2wzx2aUVPfy0nEbYBpuYw2Iq9ha1BdcOqawC7ltV8w1DeFp2a2DfcyHUrvpliCtEOaMrvv/M+EeieblUV9b7LvBa8xq7iciSD5K8NMZJkTwdB04t89/1O/w1cDnyilFU="
};
process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements


exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
  const agent = new WebhookClient({ request, response });
  console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
  console.log('Dialogflow Request body: ' + JSON.stringify(request.body));

  function welcome(agent) {
    agent.add(`Welcome to my agent!`);
  }

  function fallback(agent) {
    agent.add(`I didn't understand`);
    agent.add(`I'm sorry, can you try again?`);
  }

  function getReg(agent) {
    //agent.add(`มี คาปูชิโน่ EMU Run`); 
    const userId = request.body.originalDetectIntentRequest.payload.data.source.userId
    agent.add(userId)
  }

  let intentMap = new Map();
  intentMap.set('Default Welcome Intent', welcome);
  intentMap.set('Default Fallback Intent', fallback);
  intentMap.set('Registration', getReg);
  // intentMap.set('<INTENT_NAME_HERE>', yourFunctionHandler);
  // intentMap.set('<INTENT_NAME_HERE>', googleAssistantHandler);
  agent.handleRequest(intentMap);
});


exports.LineAdapter = functions.https.onRequest((req, res) => {
  if (req.method === "POST") {
    let event = req.body.events[0]
    if (event.type === "message" && event.message.type === "text") {

      postToDialogflow(req);
      //reply(req);
    }
    else if (event.type === "message" && event.message.type === "location") {
      if (event.message.title == undefined)
        event.message.title = "ไม่มีสถานที่เด่น ,"
      else
        event.message.title = event.message.title + ", "
      req.body.events[0] =
        {
          "type": event.type,
          "replyToken": event.replyToken,
          "source": {
            "userId": event.source.userId,
            "type": event.source.type
          },
          "timestamp": event.timestamp,
          "message": {
            "type": "text",
            "id": event.message.id,
            "text": event.message.title + event.message.address + ", latitude : " + event.message.latitude + ", longitude : " + event.message.longitude,
          }
        }

      const hash = crypto.createHmac('sha256', secret)
        .update(JSON.stringify(req.body))
        .digest('base64');

      console.log(hash);

      req.headers["x-line-signature"] = hash
      postToDialogflow(req);
      reply(req);
    }
    else {
      //reply(req);
    }
  }
  return res.status(200).send(req.method);
});

const reply = req => {
  console.log(JSON.stringify(req.headers) + JSON.stringify(req.body));

  return request.post({
    uri: `${LINE_MESSAGING_API}/reply`,
    headers: LINE_HEADER,
    body: JSON.stringify({
      replyToken: req.body.events[0].replyToken,
      messages: [
        {
          type: "text",
          text: req.body.events[0].message.text
        }
      ]
    })
  });
};

const postToDialogflow = req => {
  req.headers.host = "bots.dialogflow.com";
  return request.post({
    uri: "https://bots.dialogflow.com/line/2030fdf2-c8f1-43af-b6e5-23a1159a593d/webhook",
    headers: req.headers,
    body: JSON.stringify(req.body)
  });
};