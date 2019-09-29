'use strict';

const functions = require('firebase-functions');
const cors = require('cors')({ origin: true });
const config = require('./config.json');
const rp = require('request-promise');
const { WebhookClient, Payload } = require('dialogflow-fulfillment');
const { Card, Suggestion } = require('dialogflow-fulfillment');
const admin = require('firebase-admin');
const request = require("request-promise");
const crypto = require('crypto');
const secret = '442856b88bad478ad8e2d4e54fdd20f2';
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: "https://coffe-system-yiakpd.firebaseio.com"
});



const LINE_MESSAGING_API = "https://api.line.me/v2/bot/message";
const LINE_HEADER = {
  "Content-Type": "application/json",
  "Authorization": "Bearer gEIeipovFZMLDya4PobyyeLzJiH98XBs6q7fxyhCnUR2wzx2aUVPfy0nEbYBpuYw2Iq9ha1BdcOqawC7ltV8w1DeFp2a2DfcyHUrvpliCtEOaMrvv/M+EeieblUV9b7LvBa8xq7iciSD5K8NMZJkTwdB04t89/1O/w1cDnyilFU="
};
process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements
let order = {
  "orderBy": "",
  "orderKeyList": [],
  "location1": "",
  "location2": "",
  "tel": "",
  "pay": "ยังไม่จ่าย",
  "lineProfile": {},
  "status": "wait"
}
let orderList = {}
let menuList = {}
let total = {}

exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
  const agent = new WebhookClient({ request, response });
  console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
  console.log('Dialogflow Request body: ' + JSON.stringify(request.body));
  const userId = request.body.originalDetectIntentRequest.payload.data.source.userId
  orderList[userId] = order
  //menuList[userId] = []
  //total[userId] = 0

  function welcome(agent) {
    agent.add(`Welcome to my agent!`);
  }

  function fallback(agent) {
    agent.add(`I didn't understand`);
    agent.add(`I'm sorry, can you try again?`);
  }

  function getReg(agent) {
    //agent.add(userId)
    return getUserInfo(userId).then(body => {
      agent.add(body)
    });
  }
  function getOrder(agent) {
    agent.add(JSON.stringify(orderList[userId]))
    agent.add(JSON.stringify(menuList[userId]))
    agent.add(JSON.stringify(total[userId]))
  }

  function checkMenu(agent) {
    let menuName = request.body.queryResult.parameters.name
    let amount = request.body.queryResult.parameters.amount
    let note = (request.body.queryResult.parameters.note == undefined ? "" : request.body.queryResult.parameters.note);

    return getMenuKey(menuName).then((data) => {
      //saveOrder(userId, data)
      console.log(data);

      let check = orderList[userId].orderKeyList.find((cur) => {
        return cur.key == data.key
      })
      if (check == undefined) {
        orderList[userId].orderKeyList.push(
          {
            "key": data.key,
            "amount": amount + "",
            "note": note
          }
        )

        menuList[userId] = (menuList[userId] == null ? [] : menuList[userId])
        menuList[userId].push(
          {
            "type": "box",
            "layout": "horizontal",
            "contents": [
              {
                "type": "text",
                "text": menuName,
                "align": "start"
              },
              {
                "type": "text",
                "text": amount + "",
                "align": "end"
              },
              {
                "type": "text",
                "text": data.price + "",
                "align": "end"
              }
            ]
          }
        )
        if (total[userId] === undefined || total[userId] == null)
          total[userId] = 0

        if (isNaN(amount) || isNaN(data.price) || isNaN(total[userId]))
          agent.add("มีบางค่าไม่ใช่ตัวเลข amount: " + amount + " data.price: " + data.price + " total[userId]: " + total[userId])

        total[userId] = Number(total[userId]) + (Number(amount) * Number(data.price))
        agent.add("บันทึกเมนู " + menuName + " จำนวน " + amount + " " + note + " เรียบร้อยแล้ว")
        agent.add(sendAsPayload({
          "type": "template",
          "altText": "ข้อความยืนยัน",
          "template": {
            "type": "confirm",
            "actions": [
              {
                "type": "message",
                "label": "ใช่",
                "text": "ใช่"
              },
              {
                "type": "message",
                "label": "ไม่",
                "text": "ไม่"
              }
            ],
            "text": "คุณต้องการสั่งเพิ่มเติมหรือไม่ ?"
          }
        }))
      }
      else {
        agent.add("คุณสั่ง " + menuName + " ไปแล้ว")
      }


    },
      (err) => {
        agent.add(err)
      })

  }

  function askName(agent) {
    let username = request.body.queryResult.parameters.username
    orderList[userId].orderBy = username
    agent.add("บันทึกชื่อของคุณ " + username + " เรียบร้อยแล้ว")
    agent.add("กรุณาบอก เบอร์มือถือของคุณด้วย")
  }

  function askTel(agent) {
    let tel = request.body.queryResult.parameters.tel
    orderList[userId].tel = tel
    agent.add("บันทึกเบอร์ของคุณ " + tel + " เรียบร้อยแล้ว")
    agent.add("กรุณาส่ง ที่อยู่ของคุณด้วย")
  }

  function askLo1(agent) {
    let lat = request.body.queryResult.parameters.lat
    let long = request.body.queryResult.parameters.long
    let location = request.body.queryResult.parameters.location

    orderList[userId].location1 = location
    agent.add("บันทึกที่อยู่ของคุณ " + location + " เรียบร้อยแล้ว")
    agent.add("กรุณาส่ง ที่อยู่เพิ่มเติมของคุณด้วย")
  }
  function askLo2(agent) {
    let more = request.body.queryResult.parameters.more
    orderList[userId].location2 = more
    agent.add("บันทึกข้อมูลเพิ่มเติมของคุณ " + more + " เรียบร้อยแล้ว")

    agent.add("สรุป ออเดอร์ของคุณคือ ")

    //agent.add(JSON.stringify(orderList[userId]))
    console.log(JSON.stringify(menuList[userId]))
    console.log(total[userId] + " " + typeof (total[userId]));

    agent.add(sendAsPayload(
      {
        "type": "flex",
        "altText": "Flex Message",
        "contents": {
          "type": "bubble",
          "direction": "ltr",
          "header": {
            "type": "box",
            "layout": "vertical",
            "contents": [
              {
                "type": "text",
                "text": "รายละเอียด",
                "align": "center",
                "weight": "bold",
                "color": "#000000"
              }
            ]
          },
          "body": {
            "type": "box",
            "layout": "vertical",
            "contents": [
              {
                "type": "box",
                "layout": "baseline",
                "contents": [
                  {
                    "type": "text",
                    "text": "เมนู",
                    "align": "start",
                    "weight": "bold"
                  },
                  {
                    "type": "text",
                    "text": "จำนวน",
                    "align": "end",
                    "weight": "bold"
                  },
                  {
                    "type": "text",
                    "text": "ราคา",
                    "align": "end",
                    "weight": "bold"
                  }
                ]
              },
              {
                "type": "box",
                "layout": "vertical",
                "contents": menuList[userId]
              },
              {
                "type": "text",
                "text": "รวม :  " + Number(total[userId]) + " บาท",
                "align": "end"
              }
            ]
          },
          "footer": {
            "type": "box",
            "layout": "horizontal",
            "contents": [
              {
                "type": "box",
                "layout": "horizontal",
                "contents": [
                  {
                    "type": "button",
                    "action": {
                      "type": "message",
                      "label": "ยืนยัน",
                      "text": "ยืนยัน"
                    },
                    "color": "#4EC322",
                    "style": "primary"
                  },
                  {
                    "type": "button",
                    "action": {
                      "type": "message",
                      "label": "ยกเลิก",
                      "text": "ยกเลิก"
                    },
                    "color": "#D2D0D0",
                    "style": "secondary"
                  }
                ]
              }
            ]
          },
          "styles": {
            "header": {
              "backgroundColor": "#DDDDDD"
            },
            "body": {
              "backgroundColor": "#FFFFFF"
            }
          }
        }
      }
    ))
  }

  function orderYes(agent) {

    let url = `https://sandbox-api-pay.line.me/v2/payments/request`;
    let orderId = new Date().getTime().toString();
    let payload = {
      productImageUrl: 'https://obs.line-scdn.net/0hnL15US6nMWMMTBu52_ZONDAJPw57YjcrdHh3BiwcbVclKSIxMCsrUn5POAAmLH5mMyt_VnlJbAEn',
      productName: "sut line pay",
      amount: total[userId],
      orderId: orderId,
      currency: "THB",
      confirmUrl: "https://us-central1-coffe-system-yiakpd.cloudfunctions.net/confirmPaymentServer",
      langCd: "th",
      confirmUrlType: "SERVER",
    };
    let headers = {
      'X-LINE-ChannelId': '1622080626',
      'X-LINE-ChannelSecret': '1d680f2ae3ab1a64aeae793df06db6ed',
      'Content-Type': 'application/json',
    };

    return reservePaymentServer(url, headers, payload).then(function (response) {
      if (response && response.returnCode === '0000' && response.info) {
        // const data = req.body;
        // const transactionId = response.info.transactionId;
        // data.transactionId = transactionId;
        console.log('reservePaymentServer ', response.info.paymentUrl.web)
        agent.add("บันทึกเรียบร้อยแล้ว")
        agent.add(response.info.paymentUrl.web)
        getUserInfo(userId).then(body => {
          orderList[userId].lineProfile = JSON.parse(body)
          saveOrder(userId, orderId)
        });
      }
    })
      .catch(function (err) {
        console.log('reservePaymentServer err', err);
      });

    //saveOrder(userId)
    // agent.add("บันทึกเรียบร้อยแล้ว")
    // return getUserInfo(userId).then(body => {
    //   orderList[userId].lineProfile = JSON.parse(body)
    //   saveOrder(userId)
    // });
  }

  function cancelOrder(agent) {
    orderList[userId].orderBy = ""
    orderList[userId].orderKeyList = []
    orderList[userId].location1 = ""
    orderList[userId].location2 = ""
    orderList[userId].tel = ""
    orderList[userId].lineProfile = {}
    menuList[userId] = []
    total[userId] = 0
    agent.add("ลบเรียบร้อยแล้วครับ")
    agent.add(JSON.stringify(orderList[userId]))
  }

  let intentMap = new Map();
  intentMap.set('Default Welcome Intent', welcome);
  intentMap.set('Default Fallback Intent', fallback);
  intentMap.set('Registration', getReg);
  intentMap.set('Order', checkMenu);
  intentMap.set('Check Order', getOrder);
  intentMap.set('Cancel Order', cancelOrder);
  intentMap.set('Ask Name', askName);
  intentMap.set('Ask Telephone', askTel);
  intentMap.set('Ask Location 1', askLo1);
  intentMap.set('Ask Location 2', askLo2);
  intentMap.set('Confirm order - Yes', orderYes);

  //intentMap.set('Ask Name - yes', saveName);
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
      //reply(req);
    }
    else {
      reply(req);
    }
  }
  return res.status(200).send(req.method);
});

exports.LineMessagingAPI = functions.https.onRequest((req, res) => {
  //console.log(req.body);
  res.header('Access-Control-Allow-Methods', 'POST');
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  linePush(req.body.userId, req.body.messages)
  return res.status(200).send(req.body);
});

const linePush = (userId, text) => {
  return request.post({
    headers: LINE_HEADER,
    uri: LINE_MESSAGING_API + "/" + "push",
    body: JSON.stringify({
      "to": userId,
      "messages": [
        {
          "type": "text",
          "text": text
        }
      ]
    })
  })
}

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
          text: JSON.stringify(req.body)
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

const getMenuKey = (menuName) => {
  return new Promise((resolve, reject) => {
    return admin.database().ref('menu').orderByChild("name").equalTo(menuName).on('value', function (snapshot) {
      //snapshot would have list of NODES that satisfies the condition
      //agent.add(JSON.stringify(snapshot.val()))
      if (snapshot.val() != null) {
        snapshot.forEach(function (childSnapshot) {
          var key = childSnapshot.key;
          var childData = childSnapshot.val();
          //console.log(key + ", " + JSON.stringify(childData));
          resolve({ key, ...childData })
        });
      }
      else {
        reject("ไม่พบข้อมูลของ " + menuName)
      }

    });
  })

}
// function saveTx(orderId, object) {
//   object['lastActionDate'] = Date.now();
//   var txRef = database.ref("/transactions/" + orderId);
//   return txRef.update(object);
// }

const saveOrder = (userId, orderId) => {
  let member = admin.database().ref('member')
  member.orderByChild('userId').equalTo(userId).once('value', function (snapshot) {
    if (snapshot.val() === null) {
      admin.database().ref("member").push({
        displayName:  orderList[userId].lineProfile.displayName,
        userId:  orderList[userId].lineProfile.userId,
        pictureUrl:  orderList[userId].lineProfile.pictureUrl,
        statusMessage:  orderList[userId].lineProfile.statusMessage,
        point: 0
      }).then((snap) => {
        orderList[userId].total = total[userId]
        orderList[userId].timestamp = Date.now();
        orderList[userId].lineProfile = snap.key
        admin.database().ref("order").child(orderId).update(orderList[userId]).then(() => {
          orderList[userId].orderBy = ""
          orderList[userId].orderKeyList = []
          orderList[userId].location1 = ""
          orderList[userId].location2 = ""
          orderList[userId].tel = ""
          orderList[userId].lineProfile = {}
          orderList[userId].total = 0
          menuList[userId] = []
          total[userId] = 0
        })
      })
    }
    else {
      let db = admin.database().ref("order").child(orderId)
      orderList[userId].total = total[userId]
      orderList[userId].timestamp = Date.now();
      orderList[userId].lineProfile = Object.keys(snapshot.val())[0]
      db.update(
        orderList[userId]
      ).then(() => {
        orderList[userId].orderBy = ""
        orderList[userId].orderKeyList = []
        orderList[userId].location1 = ""
        orderList[userId].location2 = ""
        orderList[userId].tel = ""
        orderList[userId].lineProfile = {}
        orderList[userId].total = 0
        menuList[userId] = []
        total[userId] = 0
      })
    }
  })
}

const sendAsPayload = (json) => {
  return new Payload(`LINE`, json, { sendAsMessage: true })
}

const getUserInfo = (userId) => {

  return request.get({
    uri: "https://api.line.me/v2/bot/profile/" + userId,
    headers: LINE_HEADER,
    body: ""
  })

}

const reservePaymentServer = (url, headers, payload) => {
  return request.post({
    uri: url,
    headers: headers,
    body: payload,
    json: true
  })
}

exports.confirmPaymentServer = functions.https.onRequest((req, res) => {
  return cors(req, res, () => {
    confirmPaymentServer(req, res);
  });
});


function confirmPaymentServer(req, res) {
  let { transactionId, orderId } = req.query;
  console.log('confirmPaymentServer', JSON.stringify(req.query));
  let url = `${config.linepay.api}/v2/payments/${transactionId}/confirm`;
  let data;
  getOrderInfo(orderId)
    .then((orderInfo) => {
      data = orderInfo;
      let body = {
        amount: data.total,
        currency: 'THB',
      };
      let headers = {
        'X-LINE-ChannelId': config.linepay.channelId,
        'X-LINE-ChannelSecret': config.linepay.channelSecret,
        'Content-Type': 'application/json',
      };
      return rp({
        method: 'POST',
        uri: url,
        body: body,
        headers,
        json: true,
      });
    })
    .then(function (response) {
      console.log('confirmPaymentServer response', JSON.stringify(response));
      if (response && response.returnCode === '0000' && response.info) {
        console.log('ได้รับชำระเงินเรียบร้อยแล้ว')
        console.log('data == ',data)
        data.pay = 'จ่ายแล้ว'
        admin.database().ref("order").child(orderId).update(data)

        admin.database().ref('member').child(data.lineProfile).once('value', function (snapshot) {
          console.log('snapshot.val().userId === ',snapshot.val().userId)
          let point = data.total >= 20 ? Math.floor(data.total / 20) : 0
          admin.database().ref('member').child(data.lineProfile).update({
            point : snapshot.val().point + point
          })
          linePush(snapshot.val().userId, 'ได้รับชำระเงินเรียบร้อยแล้ว')
        })
      }
      res.send(response);
    })
    .catch(function (err) {
      console.log('confirmPaymentServer err', err);
      res.status(400).send(err);
    });
};

function getOrderInfo(orderId) {
  return new Promise((resolve, reject) => {
    let list = [];
    var txRef = admin.database().ref("order").child(orderId).once("value", function (snapshot) {
      list.push(snapshot.val());
      if (list.length > 0) {
        resolve(list[0]);
      } else {
        reject();
      }
    });
  });
}

