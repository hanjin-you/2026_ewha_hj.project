let video;
let handPose;
let hands = [];
let recorder;
let chunks = [];
let isRecording = false;
let trackingData = [];
let lastRecordedSec = -1;

const connections = [
  [0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [0, 9, 10, 11, 12], [0, 13, 14, 15, 16], [0, 17, 18, 19, 20]
];

function preload() {
  // ml5가 로드되었는지 확인 후 호출
  if (typeof ml5 !== 'undefined') {
    handPose = ml5.handPose({ flipped: true, maxHands: 2 });
  } else {
    console.error("ml5 라이브러리가 로드되지 않았습니다. index.html을 확인하세요.");
  }
}

function setup() {
  let canvas = createCanvas(640, 480);
  
  // 카메라 설정을 더 단순하게 변경 (호환성 상향)
  video = createCapture(VIDEO, function(stream) {
    console.log("카메라 연결 성공");
  });
  
  video.size(640, 480);
  video.hide();
  
  // [수정된 부분] video가 정상적으로 생성되었을 때만 속성 부여
  if (video && video.elt) {
    video.elt.setAttribute('playsinline', '');
    video.elt.setAttribute('muted', '');
  }

  // handPose 모델 시작
  if (handPose) {
    handPose.detectStart(video, (results) => { hands = results; });
  }

  let btn = createButton('실험 시작');
  btn.position(10, 490);
  btn.style('padding', '15px');
  btn.mousePressed(() => toggleRecording(btn));

  // 녹화 장치 설정
  let stream = canvas.elt.captureStream(30);
  let mimeType = MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4';
  recorder = new MediaRecorder(stream, { mimeType });
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  recorder.onstop = exportData;
}

function draw() {
  background(0);

  let currentSec = floor(millis() / 1000);
  
  // hands가 비어있지 않은지 확인
  if (hands && hands.length > 0) {
    let currentFrame = { time: currentSec };

    for (let i = 0; i < hands.length; i++) {
      let hand = hands[i];
      if (hand && hand.keypoints) {
        drawHand(hand, hand.handedness);

        if (isRecording && currentSec > lastRecordedSec) {
          let side = hand.handedness;
          let wrist = hand.keypoints[0];

          currentFrame[`${side}_Wrist_AbsX`] = round(wrist.x);
          currentFrame[`${side}_Wrist_AbsY`] = round(wrist.y);

          hand.keypoints.forEach((pt, idx) => {
            if (idx > 0) {
              currentFrame[`${side}_pt${idx}_relX`] = round(pt.x - wrist.x);
              currentFrame[`${side}_pt${idx}_relY`] = round(pt.y - wrist.y);
            }
          });
        }
      }
    }
    
    if (isRecording && currentSec > lastRecordedSec) {
      trackingData.push(currentFrame);
      lastRecordedSec = currentSec;
    }
  }

  if (isRecording) {
    fill(255, 0, 0);
    noStroke();
    circle(30, 30, 15);
    fill(255);
    text(currentSec + "s 기록 중...", 45, 35);
  }
}

// ... (drawHand, toggleRecording, exportData 함수는 이전과 동일) ...

function drawHand(hand, side) {
  strokeWeight(8);
  let clr = (side === "Left" || side === "left") ? color(180, 100, 255) : color(255, 220, 100);
  stroke(clr);
  noFill();
  for (let conn of connections) {
    beginShape();
    for (let index of conn) {
      let pt = hand.keypoints[index];
      if (pt) vertex(pt.x, pt.y);
    }
    endShape();
  }
  fill(255);
  noStroke();
  hand.keypoints.forEach(pt => { if(pt) circle(pt.x, pt.y, 5); });
}

function toggleRecording(btn) {
  if (!isRecording) {
    chunks = [];
    trackingData = [];
    lastRecordedSec = floor(millis() / 1000) - 1; 
    if(recorder) recorder.start();
    isRecording = true;
    btn.html('기록 종료 및 저장');
    btn.style('background-color', '#ff4444');
    btn.style('color', 'white');
  } else {
    if(recorder) recorder.stop();
    isRecording = false;
    btn.html('실험 시작');
    btn.style('background-color', '#efefef');
    btn.style('color', 'black');
  }
}

function exportData() {
  let blob = new Blob(chunks, { type: recorder.mimeType });
  let url = URL.createObjectURL(blob);
  let a = document.createElement('a');
  a.href = url;
  let ext = recorder.mimeType.includes('mp4') ? 'mp4' : 'webm';
  a.download = `hand_test.${ext}`;
  a.click();

  let table = new p5.Table();
  table.addColumn('time');
  let sides = ['Left', 'Right'];
  for (let s of sides) {
    table.addColumn(`${s}_Wrist_AbsX`);
    table.addColumn(`${s}_Wrist_AbsY`);
    for (let i = 1; i < 21; i++) {
      table.addColumn(`${s}_pt${i}_relX`);
      table.addColumn(`${s}_pt${i}_relY`);
    }
  }

  trackingData.forEach(d => {
    let row = table.addRow();
    row.set('time', d.time);
    for (let s of sides) {
      row.set(`${s}_Wrist_AbsX`, d[`${s}_Wrist_AbsX`] ?? "");
      row.set(`${s}_Wrist_AbsY`, d[`${s}_Wrist_AbsY`] ?? "");
      for (let i = 1; i < 21; i++) {
        row.set(`${s}_pt${i}_relX`, d[`${s}_pt${i}_relX`] ?? "");
        row.set(`${s}_pt${i}_relY`, d[`${s}_pt${i}_relY`] ?? "");
      }
    }
  });
  saveTable(table, 'hand_data.csv');
}