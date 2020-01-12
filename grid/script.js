//p5p5p5p5p5p5p5p5
let w, h;
let cw, ch; //column width, height
let rw, rh; // row width, height
let d;
let x, y;
let b;
let offset = 150;
let nextNumbers = [0, 0, 0, 0];
let score = 0;

function setup() {
  createCanvas(800, 800);
  textAlign(CENTER, CENTER);
  textSize(77);
}

function draw() {
  background(220);

  cw = (width-offset*2) / Grid.cols;
  ch = height;
  rw = width;
  rh = (width-offset*2) / Grid.rows;

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
        }
      let x = cn * cw;
      let y = rn * rh;
      rect(x+offset, y+offset, cw, rh);
      fill(0, 0, 0);
      if(Grid.map[cn][rn].preview == 0) {
        if(Grid.map[cn][rn].value >= 10){
          textSize(76);
      } else if(Grid.map[cn][rn].value >= 100) {
          textSize(66);
        } else {
          textSize(82);
        }
        text(Grid.map[cn][rn].value, x+cw/2+offset, y+rh/2+offset);
      } else {
        text(Grid.map[cn][rn].preview, x+cw/2+offset, y+rh/2+offset);
      }
    }
  }
  if(checkAllSame()) {
    for(let i = path.length-1; i < nextNumbers.length; i++) {
     text(nextNumbers[i], i*cw+offset+cw/2, 0+offset/2);
   }
 } else {
   for(let i = 0; i < nextNumbers.length; i++) {
    text(nextNumbers[i], i*cw+offset+cw/2, 0+offset/2);
  }
 }
  text(score, width/2, height-offset/2);
}

let path = [];
let allSame;
function mousePressed() {
  let col = Math.floor((mouseX-offset)/cw);
  let row = Math.floor((mouseY-offset)/rh);
  allSame = true;
  Grid.map[col][row].select();
  path.push([col, row]);
}

function mouseDragged() {
  // get mouse position as grid coordinates
  if ( mouseX <= offset || mouseY <= offset || mouseX >= width-offset || mouseY >= width-offset ) {
    for(let remove = 0; remove < path.length; remove++) {
      Grid.map[path[remove][0]][path[remove][1]].deselect();
    }
    path = [];
  } else {
    let col = Math.floor((mouseX-offset)/cw);
    let row = Math.floor((mouseY-offset)/rh);

    // check if the drag crosses itself
    for(let element = 0; element < path.length-1; element++){
      if(path[element][0] == col && path[element][1] == row){
        // remove all objects after intersection
        for(let remove = element+1; remove < path.length; remove++) {
          Grid.map[path[remove][0]][path[remove][1]].deselect();
        }
        path.splice(element+1);
        if(checkAllSame()) Grid.map[path[element][0]][path[element][1]].preview = Grid.map[col][row].value * path.length;
      }
    }

    // adding a cell to the array
    if(path[path.length-1][0] != col || path[path.length-1][1] != row){
      if(Grid.map[col][row].isNeighborOf(path[path.length-1][0], path[path.length-1][1])) {
        Grid.map[col][row].select()
        path.push([col, row]);
        Grid.map[path[path.length-2][0]][path[path.length-2][1]].preview = 0;
        if(checkAllSame()){
          Grid.map[col][row].preview = Grid.map[col][row].value * path.length;
          // preview next numbers
          for(let i = 1; i < path.length; i++){
            let prevCol = path[path.length-1-i][0]
            let prevRow = path[path.length-1-i][1]
            Grid.map[prevCol][prevRow].preview = nextNumbers[path.length-i-1];
          }
        }
      }
    }
  }
}

function checkAllSame() {
  for(let element = 0; element < path.length-1; element++){
      if( Grid.map[ path[element][0] ] [ path[element][1] ].value
      != Grid.map[ path[element+1][0] ] [ path[element+1][1] ].value) {
          return false;
      }
  }
  return true;
}
function sameAsPrev(toComp) {
}

function mouseReleased() {
  for(let row in Grid.map) {
    for(let col in Grid.map[row]) {
      Grid.map[col][row].deselect()
    }
  }
  if(path.length > 1) combineNumbers(path);
  path = [];
}

//combine function takes an array of positions and combines to the last
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
  score += Grid.map[combine[combine.length-1][0]][combine[combine.length-1][1]].value;
  // // generate new numbers for all other slots
  for(let position in combine) {
    if(position != combine.length-1){
      Grid.map[ combine[position][0]][combine[position][1] ].newValue();
    }
  }
}

function generateNext(amount=1) {
  let fiFo;
  for(let i = 0; i < amount; i++) {
    fiFo = nextNumbers.splice(0,1);
    nextNumbers.push(Math.floor(Math.random()*3)+1);
  }
  if(amount == 1) {
    return parseInt(fiFo);
  }
}
generateNext(5);
