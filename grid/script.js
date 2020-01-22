// ver 0.1
/*
TODO:
shrink
skip
non-square grid
*/

let w, h;
let cw, ch; //column width, height
let rw, rh; // row width, height
let d;
let x, y;
let b;
let offset = 120;
let score = 0;
let scores = [];
let scoreShow = false;
let path = [];
let rowPreview = false;
let colPreview = false;
let activeItem = 0;
let unequal = false; // for sum items
//undo storage
let backup = [];
let firstUndo = true;
let timesUndone = 0;
let justUndone = false;
restartConfirm = false;

let Bag = newBag();
let nextNumbers = [0, 0, 0];

let gameState // main, choice, dead

function setup() {
  createCanvas(1100, 1100);
  generateNext(5);
  textFont('Fredoka One');
  textAlign(CENTER, CENTER);
  gameState = "main";
}
function draw() {
  background(220);
  cw = (width-offset*2) / Grid.cols;
  ch = height;
  rw = width;
  rh = (width-offset*2) / Grid.rows;
  // grid coloring
  for (cn = 0; cn < Grid.cols; cn++) {
    for (rn = 0; rn < Grid.rows; rn++) {
      switch(Grid.map[cn][rn].color){
        case 0:
          switch(Grid.map[cn][rn].value){
            case 1:
              fill('#80BD68');
              break;
            case 2:
              fill('#69BA75');
              break;
            case 3:
              fill('#53B683');
              break;
            case 4:
              fill('#3FB290');
              break;
            case 5:
            case 6:
              fill('#31AC9C');
              break;
            case 8:
            case 12:
              fill('#2EA6A5');
              break;
            case 16:
            case 24:
              fill('#399FAC');
              break;
            case 48:
              fill('#4B97AF');
              break;
            case 96:
              fill('#5D8FAF');
              break;
            case 192:
              fill('#6F85AC');
              break;
            case 384:
              fill('#7F7CA5');
              break;
            case 768:
              fill('#8C729B');
              break;
            case 1536:
              fill('#96698E');
              break;
            case 182:
              fill('#9D6180');
              break;
            default:
              fill('#A05971');
              break;

          }
          break;
        case 1:
          fill(255, 204, 0);
          break;
        case 2:
          fill(206, 149, 0);
          break;
        case 3: // col, row
          fill('#aaf99a');
          break;
        case "swap": // swap
          fill(171, 236, 106);
          break;

        }
      let x = cn * cw;
      let y = rn * rh;
      strokeWeight(6);
      rect(x+offset, y+offset, cw, rh);
      fill(0, 0, 0);

      if(Grid.map[cn][rn].preview == 0) {
        // different text sizes for different digits
        if(Grid.map[cn][rn].value >= 1000) {
          textSize(73);
        } else if(Grid.map[cn][rn].value >= 100) {
          textSize(88);
        } else if(Grid.map[cn][rn].value >= 10){
          textSize(99);
        } else {
          textSize(110);
        }
        strokeWeight(0);
        text(Grid.map[cn][rn].value, x+cw/2+offset, y+rh/2+offset+4);
      } else {
        if(Grid.map[cn][rn].preview >= 1000) {
          textSize(73);
        } else if(Grid.map[cn][rn].preview >= 100) {
          textSize(88);
        } else if(Grid.map[cn][rn].preview >= 10){
          textSize(99);
        } else {
          textSize(110);
        }
        strokeWeight(0);
        text(Grid.map[cn][rn].preview, x+cw/2+offset, y+rh/2+offset+4);
      }
    }
  }

  itemDraw();

  // display preview
  textSize(80);
  strokeWeight(1);
  if(!restartConfirm && gameState=="main"){
    if(checkAllSame() && path.length != 0) {
      for(let i = path.length; i <= nextNumbers.length; i++) {
        text(nextNumbers[i-1], (i-1)*cw+offset+cw, 0+offset/2);
      }
    } else {
      if (score != 0) {
        for(let i = 0; i < nextNumbers.length; i++) {
          text(nextNumbers[i], i*cw+offset+cw, 0+offset/2);
        }
      }
    }
  } else if (gameState == "level") {
    text("reached " + levelVal[level], offset+cw, 0+offset/2);
  }
  textAlign(RIGHT, CENTER);
  // display score
  if(path.length == 0) {
    if(restartConfirm && path.length == 0) {
      text("tap again to restart", offset, offset/2);
    } else if (score == 0) {
      textAlign(LEFT, CENTER);
      text("tap or r to restart", offset, offset/2);
      textAlign(RIGHT, CENTER);
      text("tap or u to undo", width-offset, height-offset/2);
    }
  }
  textAlign(RIGHT, CENTER);
  if(scoreShow && itemMode == 0){
    text("amt: " + scores.length + " avg: " + average(scores), width-offset, height-offset/2);
  } else if(itemMode != 0) {
    //show item text
    text(itemMode + ": " + Items[activeItem-1].charge, width-offset, height-offset/2);
  } else if(justUndone) {
    text(score + " -" + Math.floor(5*Math.pow(1.18, timesUndone)) , width-offset, height-offset/2);
  } else if(score != 0){
    text(score, width-offset, height-offset/2);
  }
  textAlign(CENTER, CENTER);
  if(gameState == "level"){
    itemDialog(selection);
  }
}


function keyPressed() {
  if (key == 'r') {
    restart();
  }
  if (key == '5') {
    restart5();
  }
  if (key == 'x') {
    scores = [];
  }
  if (key == 's') {
    scoreShow = !scoreShow;
  }
  if (key == 'u') {
    undo();
  }
  if (key == '1' && Items[0].charge > 0) {
    if(activeItem != 1) {
      itemMode = Items[0].type;
      activeItem = 1;
    } else {
      itemMode = 0;
      activeItem = 1;
    }
  }
  if (key == '2' && Items[1].charge > 0) {
    if(activeItem != 2) {
      itemMode = Items[1].type;
      activeItem = 2;
    } else {
      itemMode = 0;
      activeItem = 2;
    }
  }
  if (key == '3' && Items[2].charge > 0) {
    if(activeItem != 3) {
      itemMode = Items[2].type;
      activeItem = 3;
    } else {
      itemMode = 0;
      activeItem = 3;
    }
  }
  if (key == '6') {
    itemMode = "swap";
  }
  if (key == '7') {
    itemMode = "col";
  }
  if (key == '8') {
    itemMode = "row";
  }
  if (key == '9') {
    itemMode = "grow";
  }
}

function mousePressed() {
  pressed();
}
function mouseDragged() {
  dragged();
}
function mouseReleased() {
  release();
}

function touchStarted() {
  pressed();
}
function touchMoved() {
  dragged();
  return false;
}
function touchEnded() {
  release();
}

function pressed() {
  if(gameState == "main") {
    if ( !(mouseX <= offset || mouseY <= offset || mouseX >= width-offset || mouseY >= height-offset) ) {
      let col = Math.floor((mouseX-offset)/cw);
      let row = Math.floor((mouseY-offset)/rh);
      Grid.map[col][row].select();
      restartConfirm = false;
      path.push([col, row]);
    }
    if (mouseButton === RIGHT) {
      path = [];
    }
    itemClick();
    itemPressed();
  } else if(gameState == "level") {
    levelPress(mouseX, mouseY);
  }
}
function dragged() {
  // mouse oputside of grid
  if ( bounds() ) {
    maxLength(0);
  } else {
    // get mouse position as grid coordinates
    let col = Math.floor((mouseX-offset)/cw);
    let row = Math.floor((mouseY-offset)/rh);

    // check if the drag crosses itself
    dragCross(col, row);

    // adding a cell to the array
    if(path.length > 0 && Grid.map[col][row].isNeighborOf(path[path.length-1][0], path[path.length-1][1])) {
      Grid.map[col][row].select()
      path.push([col, row]);
      if( itemMode == 0 ) {
        if(path.length-2 >= 0) {
          Grid.map[path[path.length-2][0]][path[path.length-2][1]].color = 2;
          Grid.map[path[path.length-2][0]][path[path.length-2][1]].preview = 0;
        }
        if(checkAllSame()){
          // preview combined number
          Grid.map[col][row].preview = Grid.map[col][row].value * path.length;
          // preview next numbers
          drawPreview();
        } else {
          for(let i = 0; i < path.length-1; i++) {
            Grid.map[path[i][0]][path[i][1]].preview = 0;
          }
        }
      }
    }
    if(itemMode) itemDrag();
  }
}
function release() {
  if (mouseY >= height-offset && !justUndone) undo();
  if (mouseY <= offset) {
    if (score != 0 && restartConfirm) {
      restartConfirm = false;
      restart();
    } else if (score != 0) {
      // restartConfirm = true;
    } else if(score==0) restart();
  }
  for(let row in Grid.map) {
    for(let col in Grid.map[row]) {
      Grid.map[col][row].deselect()
    }
  }
  // add the last move to the undo stack
  justUndone = false;

  if(path.length > 1 && !unequal){
    backup.push(addToUndo(Grid, nextNumbers, Bag, score));
    combineNumbers(path);
  }
  //execute Item abilities
  itemFinal();
  path = [];
}

function itemClick() {
  if ( (mouseX <= offset || mouseY <= offset || mouseX >= width-offset || mouseY >= height-offset) && itemMode != 0) {
    console.log("click out of bounds. canceling item.")
    itemMode = 0;
  }
  switch(itemMode) {
    case "row":
      rowPreview = true;
      if(path.length != 0) {
        Grid.map[0][path[0][1]].color = 3;
        Grid.map[1][path[0][1]].color = 3;
        Grid.map[2][path[0][1]].color = 3;
        Grid.map[3][path[0][1]].color = 3;
      }
      break;
    case "col":
      colPreview = true;
      if(path.length != 0) {
        Grid.map[path[0][0]][0].color = 3;
        Grid.map[path[0][0]][1].color = 3;
        Grid.map[path[0][0]][2].color = 3;
        Grid.map[path[0][0]][3].color = 3;
      }
      break;
    case "swap":
      if(path.length != 0) Grid.map[path[0][0]][path[0][1]].color = "swap";
      break;
    case "sum":
      unequal = true;
      break;
    case "sum6":
      unequal = true;
      break;
    case "grow":
      Grid.map[path[0][0]][path[0][1]].preview = Grid.map[path[0][0]][path[0][1]].value+1;
      break;
    case "pick":
      let temp = nextNumbers.pop();
      nextNumbers.unshift([Grid.map[path[0][0]][path[0][1]].value]);
      Grid.map[path[0][0]][path[0][1]].value = temp[0];
      itemDeplete();
      break;
    case "shift":
      let temp2 = nextNumbers.shift();
      nextNumbers.push(temp2[0]);
      itemDeplete();
      break;
    }

}
function itemDrag() {
  switch(itemMode) {
    case "row":
      maxLength(2);
      rowPreview = true;
      if(path.length != 0) {
        Grid.map[0][path[0][1]].color = 3;
        Grid.map[1][path[0][1]].color = 3;
        Grid.map[2][path[0][1]].color = 3;
        Grid.map[3][path[0][1]].color = 3;
      }
      if(path.length > 1){
        if(!(path[0][0] == path[1][0]+1 || path[0][0] == path[1][0]-1)) {
          maxLength(1);
        } else if(path[0][0] == path[1][0]+1) {
          Grid.map[0][path[1][1]].color = 1;
          Grid.map[1][path[1][1]].color = 3;
          Grid.map[2][path[1][1]].color = 3;
          Grid.map[3][path[1][1]].color = 3;
          Grid.map[3][path[0][1]].preview = Grid.map[0][path[0][1]].value;
          Grid.map[0][path[0][1]].preview = Grid.map[1][path[0][1]].value;
          Grid.map[1][path[0][1]].preview = Grid.map[2][path[0][1]].value;
          Grid.map[2][path[0][1]].preview = Grid.map[3][path[0][1]].value;
        } else if(path[0][0] == path[1][0]-1) {
          Grid.map[0][path[1][1]].color = 3;
          Grid.map[1][path[1][1]].color = 3;
          Grid.map[2][path[1][1]].color = 3;
          Grid.map[3][path[1][1]].color = 1;
          Grid.map[3][path[0][1]].preview = Grid.map[2][path[0][1]].value;
          Grid.map[2][path[0][1]].preview = Grid.map[1][path[0][1]].value;
          Grid.map[1][path[0][1]].preview = Grid.map[0][path[0][1]].value;
          Grid.map[0][path[0][1]].preview = Grid.map[3][path[0][1]].value;
        }
      }
      break;
    case "col":
      maxLength(2);
      colPreview = true;
      if(path.length != 0) {
        Grid.map[path[0][0]][0].color = 3;
        Grid.map[path[0][0]][1].color = 3;
        Grid.map[path[0][0]][2].color = 3;
        Grid.map[path[0][0]][3].color = 3;
      }
      if(path.length > 1){
        if(!(path[0][1] == path[1][1]+1 || path[0][1] == path[1][1]-1)) {
          maxLength(1);
        } else if(path[0][1] == path[1][1]+1) {
          Grid.map[path[0][0]][0].color = 3;
          Grid.map[path[0][0]][1].color = 3;
          Grid.map[path[0][0]][2].color = 3;
          Grid.map[path[0][0]][3].color = 3;
          Grid.map[path[0][0]][0].preview = Grid.map[path[0][0]][1].value;
          Grid.map[path[0][0]][1].preview = Grid.map[path[0][0]][2].value;
          Grid.map[path[0][0]][2].preview = Grid.map[path[0][0]][3].value;
          Grid.map[path[0][0]][3].preview = Grid.map[path[0][0]][0].value;
        } else if(path[0][1] == path[1][1]-1) {
          Grid.map[path[0][0]][0].color = 3;
          Grid.map[path[0][0]][1].color = 3;
          Grid.map[path[0][0]][2].color = 3;
          Grid.map[path[0][0]][3].color = 3;
          Grid.map[path[0][0]][0].preview = Grid.map[path[0][0]][3].value;
          Grid.map[path[0][0]][1].preview = Grid.map[path[0][0]][0].value;
          Grid.map[path[0][0]][2].preview = Grid.map[path[0][0]][1].value;
          Grid.map[path[0][0]][3].preview = Grid.map[path[0][0]][2].value;
        }
      }
      break;
    case "swap":
      maxLength(2);
      if(path.length != 0) Grid.map[path[0][0]][path[0][1]].color = "swap";
      if(path.length == 2) {
        Grid.map[path[1][0]][path[1][1]].color = "swap";
        Grid.map[path[0][0]][path[0][1]].preview = Grid.map[path[1][0]][path[1][1]].value;
        Grid.map[path[1][0]][path[1][1]].preview = Grid.map[path[0][0]][path[0][1]].value;
      }
      break;
    case "sum":
      if(path.length == 3) {
        //smaller than 4 means preview
        if(Grid.map[path[0][0]][path[0][1]].value + Grid.map[path[1][0]][path[1][1]].value + Grid.map[path[2][0]][path[2][1]].value <= 4) {
          unequal = true;
          Grid.map[path[2][0]][path[2][1]].preview = Grid.map[path[0][0]][path[0][1]].value + Grid.map[path[1][0]][path[1][1]].value + Grid.map[path[2][0]][path[2][1]].value;
          Grid.map[path[0][0]][path[0][1]].preview = nextNumbers[0];
          Grid.map[path[1][0]][path[1][1]].preview = nextNumbers[1];
        }
        // bigger than 4 means shorten
        if (Grid.map[path[0][0]][path[0][1]].value + Grid.map[path[1][0]][path[1][1]].value + Grid.map[path[2][0]][path[2][1]].value > 4) {
          maxLength(2);
        }
      }
      if(path.length == 2){
          if (Grid.map[path[0][0]][path[0][1]].value + Grid.map[path[1][0]][path[1][1]].value > 4) {
            maxLength(1);
            break;
          }
          if(Grid.map[path[0][0]][path[0][1]].value + Grid.map[path[1][0]][path[1][1]].value <= 4) {
            unequal = true;
            Grid.map[path[1][0]][path[1][1]].preview = Grid.map[path[0][0]][path[0][1]].value + Grid.map[path[1][0]][path[1][1]].value;
            Grid.map[path[0][0]][path[0][1]].preview = nextNumbers[0];
          }
        }
        break;
    case "sum6":
      if(path.length == 4) {
        //exactly 6 means preview
        if(Grid.map[path[0][0]][path[0][1]].value + Grid.map[path[1][0]][path[1][1]].value + Grid.map[path[2][0]][path[2][1]].value + Grid.map[path[3][0]][path[3][1]].value == 6) {
          unequal = true;
          Grid.map[path[3][0]][path[3][1]].preview = 6;
          Grid.map[path[2][0]][path[2][1]].preview = nextNumbers[2];
          Grid.map[path[1][0]][path[1][1]].preview = nextNumbers[1];
          Grid.map[path[0][0]][path[0][1]].preview = nextNumbers[0];
        } else {
          maxLength(3);
        }
      }
      if(path.length == 3){
        if(Grid.map[path[0][0]][path[0][1]].value + Grid.map[path[1][0]][path[1][1]].value + Grid.map[path[2][0]][path[2][1]].value == 6) {
          unequal = true;
          Grid.map[path[2][0]][path[2][1]].preview = 6;
          Grid.map[path[1][0]][path[1][1]].preview = nextNumbers[1];
          Grid.map[path[0][0]][path[0][1]].preview = nextNumbers[0];
        }
      }
      if(path.length == 2){
        if(Grid.map[path[0][0]][path[0][1]].value + Grid.map[path[1][0]][path[1][1]].value== 6) {
          unequal = true;
          Grid.map[path[1][0]][path[1][1]].preview = 6;
          Grid.map[path[0][0]][path[0][1]].preview = nextNumbers[0];
        }
      }
      break;
    case "grow":
  }
}
function itemFinal(){
  switch(itemMode) {
    case "row":
    if(path.length > 1){
      if(!(path[0][0] == path[1][0]+1 || path[0][0] == path[1][0]-1)) {
        maxLength(1);
      } else if(path[0][0] == path[1][0]+1) {
        let placeHold = Grid.map[3][path[0][1]].value;
        Grid.map[3][path[0][1]].value = Grid.map[0][path[0][1]].value;
        Grid.map[0][path[0][1]].value = Grid.map[1][path[0][1]].value;
        Grid.map[1][path[0][1]].value = Grid.map[2][path[0][1]].value;
        Grid.map[2][path[0][1]].value = placeHold;
        maxLength(0);
        itemMode = 0;
      } else if(path[0][0] == path[1][0]-1) {
        let placeHold = Grid.map[3][path[0][1]].value;
        Grid.map[3][path[0][1]].value = Grid.map[2][path[0][1]].value;
        Grid.map[2][path[0][1]].value = Grid.map[1][path[0][1]].value;
        Grid.map[1][path[0][1]].value = Grid.map[0][path[0][1]].value;
        Grid.map[0][path[0][1]].value = placeHold;
        maxLength(0);
        itemDeplete();
      }
    }
      break;
    case "col":
      if(path.length > 1){
        if(!(path[0][1] == path[1][1]+1 || path[0][1] == path[1][1]-1)) {
          maxLength(1);
        } else if(path[0][1] == path[1][1]+1) {
          let placeHold = Grid.map[path[0][0]][3].value;
          Grid.map[path[0][0]][3].value = Grid.map[path[0][0]][0].value;
          Grid.map[path[0][0]][0].value = Grid.map[path[0][0]][1].value;
          Grid.map[path[0][0]][1].value = Grid.map[path[0][0]][2].value;
          Grid.map[path[0][0]][2].value = placeHold;
          maxLength(0);
          itemMode = 0;
        } else if(path[0][1] == path[1][1]-1) {
          let placeHold = Grid.map[path[0][0]][3].value;
          Grid.map[path[0][0]][3].value = Grid.map[path[0][0]][2].value;
          Grid.map[path[0][0]][2].value = Grid.map[path[0][0]][1].value;
          Grid.map[path[0][0]][1].value = Grid.map[path[0][0]][0].value;
          Grid.map[path[0][0]][0].value = placeHold;
          maxLength(0);
          itemDeplete();
        }
      }
      break;
    case "swap":
      if(path.length == 2 && Grid.map[path[0][0]][path[0][1]].value != Grid.map[path[1][0]][path[1][1]].value) {
        let swap = Grid.map[path[0][0]][path[0][1]].value
        Grid.map[path[0][0]][path[0][1]].value = Grid.map[path[1][0]][path[1][1]].value;
        Grid.map[path[1][0]][path[1][1]].value = swap;
        maxLength(0);
        itemDeplete();
      }
      path = [];
      break;
    case "sum":
      if(path.length == 3) {
        console.log(Grid.map[path[2][0]][path[2][1]].value);
        //smaller than 4 means preview
        if(Grid.map[path[0][0]][path[0][1]].value + Grid.map[path[1][0]][path[1][1]].value + Grid.map[path[2][0]][path[2][1]].value <= 4) {
          Grid.map[path[2][0]][path[2][1]].value = Grid.map[path[0][0]][path[0][1]].value + Grid.map[path[1][0]][path[1][1]].value + Grid.map[path[2][0]][path[2][1]].value;
          Grid.map[path[0][0]][path[0][1]].value = nextNumbers[0][0];
          Grid.map[path[1][0]][path[1][1]].value = nextNumbers[1][0];
        }
        unequal = false;
        itemDeplete();
      }
      if(path.length == 2){
        if(Grid.map[path[0][0]][path[0][1]].value + Grid.map[path[1][0]][path[1][1]].value <= 4) {
          Grid.map[path[1][0]][path[1][1]].value = Grid.map[path[0][0]][path[0][1]].value + Grid.map[path[1][0]][path[1][1]].value;
          Grid.map[path[0][0]][path[0][1]].value = nextNumbers[0][0];
        }
        unequal = false;
        itemDeplete();
      }
      break;
    case "sum6":
      if(path.length == 4) {
        console.log(Grid.map[path[2][0]][path[2][1]].value);
        //exactly 6 means preview
        if(Grid.map[path[0][0]][path[0][1]].value + Grid.map[path[1][0]][path[1][1]].value + Grid.map[path[2][0]][path[2][1]].value + Grid.map[path[3][0]][path[3][1]].value == 6) {
          Grid.map[path[3][0]][path[3][1]].value = 6;
          Grid.map[path[2][0]][path[2][1]].value = nextNumbers[2][0];
          Grid.map[path[1][0]][path[1][1]].value = nextNumbers[1][0];
          Grid.map[path[0][0]][path[0][1]].value = nextNumbers[0][0];
          unequal = false;
          itemDeplete();
        }
      }
      if(path.length == 3){
        if(Grid.map[path[0][0]][path[0][1]].value + Grid.map[path[1][0]][path[1][1]].value + Grid.map[path[2][0]][path[2][1]].value == 6) {
          Grid.map[path[2][0]][path[2][1]].value = 6;
          Grid.map[path[1][0]][path[1][1]].value = nextNumbers[1][0];
          Grid.map[path[0][0]][path[0][1]].value = nextNumbers[0][0];
          unequal = false;
          itemDeplete();
        }
      }
      if(path.length == 2){
        if(Grid.map[path[0][0]][path[0][1]].value + Grid.map[path[1][0]][path[1][1]].value == 6) {
          Grid.map[path[1][0]][path[1][1]].value = 6;
          Grid.map[path[0][0]][path[0][1]].value = nextNumbers[0][0];
          unequal = false;
          itemDeplete();
        }
      }
      break;
    case "grow":
      if(path.length == 1) {
        Grid.map[path[0][0]][path[0][1]].value = Grid.map[path[0][0]][path[0][1]].value+1;
        Items[activeItem-1].charge--;
        activeItem = 0;
        maxLength(0);
        itemMode = 0;
      } else if (!bounds()) {
        maxLength(0);
      }
      break;
  }
}

// returns the icon for the item type
function itemIcon(type) {
  let toShow = " ";
  switch(type) {
    case "grow":
    toShow = "+"
    break;
    case "swap":
    toShow = "x";
    break;
    case "col":
    toShow = "|";
    break;
    case "row":
    toShow = "-";
    break;
    case "shift":
    toShow = "<";
    break;
    case "pick":
    toShow = ">";
    break;
    case "sum":
    toShow = "4";
    break;
    case "sum6":
    toShow = "6";
    break;
  }
  return toShow;
}
// reduce item charge by 1
function itemDeplete() {
  if(Items[activeItem-1].charge>=1){
    Items[activeItem-1].charge--;
  } else {
    Items[activeItem-1].charge = 0;
    Items[activeItem-1].depleted = true;
  }
  activeItem = 0;
  itemMode = 0;
}
// item side display
function itemDraw(){
  let itemOff = 30;
  //item display
  fill(133);
  stroke(0);
  for(let i = 0; i < Items.length; i++) {
    if (Items[i] != 0) if(Items[i].charge > 0) {
      textAlign(CENTER,CENTER);
      textSize(55);
      let from = color('#D9889C');
      let to = color('#5D768B');
      if(Items[i].charge < 6) {
        fill(lerpColor(from, to,Items[i].charge /6));
      }
      strokeWeight(8);
      rect(0+itemOff/2, i*((width-offset*2) / 3)+offset, (cw-itemOff)/2, (width-offset*2) / 3);
      textSize(85);
      fill(0);
      strokeWeight(0);
      text(itemIcon(Items[i].type), 0+itemOff*3/4, (i+.5)*((width-offset*2) / 3)+offset, (cw-itemOff)/2);
      fill(133);
    }
  }
  fill(0);
}
// item selection dialog draw
function itemDialog(selection) {
  // console.log(selection);
  for(let item = 0; item <= selection.length-1; item++) {
    let extraOff = 30;
    let xOffset = ( (width-(offset+extraOff)*2) /selection.length)
    let xShift = offset+extraOff+ ( (width-(offset+extraOff)*2) /selection.length) /2
    fill('#32cd60');
    rectMode(CORNER);
    strokeWeight(10);
    rect(offset+extraOff+xOffset*item,height/3,xOffset,height/3);
    if(selection[item].hasOwnProperty('type')) {
      strokeWeight(25);
      stroke('#0e5e07');
      fill('#073116');
      textSize(166);
      textAlign(CENTER, CENTER);
      text(itemIcon(selection[item].type),xOffset*item+xShift,(height)*1.5/3+20);
      strokeWeight(0);
      fill('#123420');
      textSize(72);
      textAlign(LEFT, CENTER);
      text(selection[item].type,xOffset*item+offset+extraOff*2,(height)*1.5/3-130);
      textAlign(RIGHT, CENTER);
      text("x" + selection[item].charge,xOffset*item+offset+extraOff+ ( (width-(offset+extraOff)*2) /selection.length)*.9,(height)*1.5/3+122);
    } else {
      strokeWeight(0);
      fill('#123420');
      textSize(72);
      textAlign(LEFT, CENTER);
      text("chg",xOffset*item+offset+extraOff*2,(height)*1.5/3-130);
      textAlign(RIGHT, CENTER);
      text("+" + selection[item],xOffset*item+offset+extraOff+ ( (width-(offset+extraOff)*2) /selection.length)*.9,(height)*1.5/3+122);
    }
    stroke(0);
    textAlign(CENTER, CENTER);
  }
}
function levelPress(x, y) {
  // console.log(offset+extraOff+xOffset*item, x, );
  let extraOff = 30;
  let xOffset = ( (width-(offset+extraOff)*2) /selection.length)
  let xShift = offset+extraOff+ ( (width-(offset+extraOff)*2) /selection.length) /2
  for(let item = 0; item <= selection.length-1; item++) {
    if(x > offset+extraOff+xOffset*item && x < offset+extraOff+xOffset*(item+1)) {
      if(selection[item].hasOwnProperty('type')) {
        for(itm in Items) {
          if(Items[itm].type == selection[item].type) {
            console.log("type match ", selection[item].type);
            Items[itm].charge = selection[item].charge;
            selection = 0;
            break;
          }
        }
        for(itm in Items) {
          if(Items[itm]==0 || Items[itm].depleted == true){
            Items[itm] = selection[item];
            selection = 0;
            break;
          }
        }
      } else {
        Items[Math.floor(Math.random()*Items.length)].charge += selection[item];
        selection = 0;
      }
    }
  }
  if(x > offset+extraOff && x<width-(offset+extraOff)) {
    level++;
    gameState = 'main';
    isLeveled(lastComboVal);
  }
}
// clicking on a sidebar item activates it
function itemPressed() {
  let itemHeight = ((width-offset*2) / 3);
  if(score!=0){
    if( 0 < mouseX && mouseX < offset && offset < mouseY && mouseY < offset+itemHeight ){
      console.log(1);
      if (Items[0].charge > 0) {
        if(activeItem != 1) {
          itemMode = Items[0].type;
          activeItem = 1;
        } else {
          itemMode = 0;
          activeItem = 0;
        }
      }
    } else if( 0 < mouseX && mouseX < offset && offset+itemHeight < mouseY && mouseY < offset+itemHeight*2 ){
      if (Items[1].charge > 0) {
        if(activeItem != 2) {
          itemMode = Items[1].type;
          activeItem = 2;
        } else {
          itemMode = 0;
          activeItem = 0;
        }
      }
    } else if( 0 < mouseX && mouseX < offset && offset+itemHeight*2 < mouseY && mouseY < offset+itemHeight*3 ){
      if (Items[2].charge > 0) {
        if(activeItem != 3) {
          itemMode = Items[2].type;
          activeItem = 3;
        } else {
          itemMode = 0;
          activeItem = 0;
        }
      }
    }
  }
}

//check if a drag selection crosses itself
function dragCross(col, row) {
  for(let element = 0; element < path.length-1; element++){
    if(path[element][0] == col && path[element][1] == row){
      // remove all objects after intersection
      maxLength(element+1);
      if(checkAllSame()) {
        Grid.map[col][row].preview = Grid.map[col][row].value * path.length;
        // preview next numbers
        drawPreview();
      }
    }
  }
}
// reduces the length of the path array
function maxLength(length) {
  if(colPreview && length <= 1) {
    Grid.map[path[0][0]][0].deselect;
    Grid.map[path[0][0]][1].deselect;
    Grid.map[path[0][0]][2].deselect;
    Grid.map[path[0][0]][3].deselect;
    Grid.map[path[0][0]][0].preview = Grid.map[path[0][0]][0].value;
    Grid.map[path[0][0]][1].preview = Grid.map[path[0][0]][1].value;
    Grid.map[path[0][0]][2].preview = Grid.map[path[0][0]][2].value;
    Grid.map[path[0][0]][3].preview = Grid.map[path[0][0]][3].value;
    console.log("wiping col preview");
    colPreview = false;
  }
  if(rowPreview && length == 1) {
    Grid.map[0][path[0][0]].deselect;
    Grid.map[1][path[0][0]].deselect;
    Grid.map[2][path[0][0]].deselect;
    Grid.map[3][path[0][0]].deselect;
    Grid.map[0][path[0][0]].preview = Grid.map[0][path[0][0]].value;
    Grid.map[1][path[0][0]].preview = Grid.map[1][path[0][0]].value;
    Grid.map[2][path[0][0]].preview = Grid.map[2][path[0][0]].value;
    Grid.map[3][path[0][0]].preview = Grid.map[3][path[0][0]].value;
    console.log("wiping row preview");
    rowPreview = false;
  }
  while(path.length > length) {
    Grid.map[path[path.length-1][0]][path[path.length-1][1]].deselect();
    path.splice(path.length-1);
  }
}
// draws the ongrid piece previews
function drawPreview() {
  for(let i = 1; i < path.length; i++){
    let prevCol = path[path.length-1-i][0]
    let prevRow = path[path.length-1-i][1]
    if(path.length-i-1 >= nextNumbers.length) {
      Grid.map[prevCol][prevRow].preview = "?";
    } else {
      Grid.map[prevCol][prevRow].preview = nextNumbers[path.length-i-1];
    }
  }
}
// checks if all numbers are equal
function checkAllSame() {
  for(let element = 0; element < path.length-1; element++){
      if( Grid.map[ path[element][0] ] [ path[element][1] ].value
      != Grid.map[ path[element+1][0] ] [ path[element+1][1] ].value) {
          return false;
      }
  }
  return true;
}
// combine function takes an array of positions and combines to the last position
function combineNumbers(combine) {
  // compare positions with grid values and check if numbers match
  for(let position = 0; position < combine.length-1; position++){
    if(Grid.map[combine[position][0]][combine[position][1]].value
    != Grid.map[ combine[position+1][0]][combine[position+1][1] ].value){
      console.log("numbers not equal");
      return false;
    }
  }
  // multiply last with amount of equal cells
  Grid.map[combine[combine.length-1][0]][combine[combine.length-1][1]].value *= combine.length;
  isLeveled(Grid.map[combine[combine.length-1][0]][combine[combine.length-1][1]].value);
  score += Grid.map[combine[combine.length-1][0]][combine[combine.length-1][1]].value;
  // // generate new numbers for all other slots
  for(let position in combine) {
    if(position != combine.length-1){
      Grid.map[ combine[position][0]][combine[position][1] ].newValue();
    }
    // increase score if preview length reached
    let bonus = Grid.map[combine[combine.length-1][0]][combine[combine.length-1][1]].value;
    if(position > nextNumbers.length) {
      score += bonus;
      console.log(bonus);
    }
  }
  firstUndo = true;
}
// get the average score
function average(average) {
    let sum = 0;
    for(let i = 0; i < average.length; i++) sum += average[i];
    return Math.floor(sum/average.length);
}
// check if the cursor is inside the grid
function bounds() {
  if (mouseX <= offset || mouseY <= offset || mouseX >= width-offset || mouseY >= width-offset) return true;
  return false;
}

// restart the game
function restart() {
  Grid = createGrid(4, 4);
  if(score != 0) scores.push(score);
  level = 0;
  backup = [];
  backup.push(addToUndo(Grid, nextNumbers, Bag, score));
  score = 0;
  nextNumbers = [0, 0, 0];
  timesUndone = 0;
  firstUndo = true;
  gameState = "main";
  generateNext(5);
  Bag = newBag();
  Items = [0,0,0];
  Items = initItem(Items);
}
function restart5() {
  Grid = createGrid(5, 5);
  level = 0;
  backup = [];
  backup.push(addToUndo(Grid, nextNumbers, Bag, score));
  score = 0;
  nextNumbers = [0, 0, 0, 0];
  timesUndone = 0;
  firstUndo = true;
  gameState = "main";
  generateNext(5);
  Bag = newBag();
  Items = [0,0,0];
  Items = initItem(Items);
}

// undo the last turn
function undo() {
  // update grid values from backup array
  if(backup.length > 0 && firstUndo) {
    if( backup[backup.length-1].score-5*Math.pow(1.18, timesUndone+1) > 0 || backup[backup.length-1].score < 48 ) {
      // update grid values
      for(let row = 0; row < Grid.rows; row++){
        for(let col = 0; col < Grid.cols; col++){
          Grid.map[row][col].value = backup[backup.length-1].grid[row][col];
        }
      }
      nextNumbers = backup[backup.length-1].next;
      Bag = backup[backup.length-1].bag;
      score = backup[backup.length-1].score;

      if (backup.length > 1) backup.splice(backup.length-1); //leave the last restart as safestate
      if(score > 48) {
        timesUndone++;
        justUndone = true;
        // score -= Math.floor(5*Math.pow(1.18, timesUndone));
      }
      firstUndo = false;
    }
  }

}
// add a turn to the undo stack
function addToUndo(grid, next, bag, score) {
  // make a backup of grid values
  let gridCopy = [];
  if( path.length > nextNumbers.length) gridCopy = [];
  for(let row = 0; row < Grid.rows; row++){
    let rowTemp = [];
    for(let col = 0; col < Grid.cols; col++){
      rowTemp.push(Grid.map[row][col].value);
    }
    gridCopy.push(rowTemp);
  }

  let state = {
    "grid": gridCopy,
    "next": JSON.parse(JSON.stringify(next)),
    "bag": JSON.parse(JSON.stringify(bag)),
    "score": score
  }
  return state;
}
// generate a bag of 3x123
function newBag(bag = []) {
  for(let i = 1; i<=3; i++) {
    for(let j = 0; j < 3; j++) {
      bag.push(i);
      bag = shuffle(bag);
    }
  }
  return bag;
}
// draws and returns a number from the bag, possibly refill bag
function drawBag() {
  if(Bag.length <= 3) Bag = newBag(Bag);
  // Bag = shuffle(Bag);
  return Bag.splice(0,1);
}
// shuffles an array
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// draw from the bag to fill the preview
function generateNext(amount=1) {
  let fiFo;
  for(let i = 0; i < amount; i++) {
    fiFo = nextNumbers.splice(0,1);
    nextNumbers.push(drawBag());
  }
  if(amount == 1) {
    return parseInt(fiFo);
  }
}
