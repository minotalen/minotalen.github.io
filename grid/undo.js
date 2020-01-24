let undoCharges = 5;
let maxCharges = 10;

function addCharge() {
  if(undoCharges < maxCharges) undoCharges++;
}

function drawCharges(){
  let itemOff = 30;
  fill(133, 133, 133, 111);
  strokeWeight(6);
  rect(width-offset+itemOff/2, offset, offset-itemOff, height-2*offset);
  let from = color('#D9889CDD');
  let to = color('#5D768B99');
  if(undoCharges <= 10) {
    fill(lerpColor(from, to,undoCharges /10));
  }
  if (backup.length == 0) {
    fill(133, 133, 133,'#D9889C33');
  }
  stroke(0);
  rect(width-offset+itemOff/2, height-offset, offset-itemOff, -((height-2*offset)*undoCharges/maxCharges)) ;
}

// undo the last turn
function undo() {
  // update grid values from backup array
  if(undoCharges>=3) {
    undoCharges -= 3;
    if(backup.length == 1) {
      for(let row = 0; row < Grid.rows; row++){
        for(let col = 0; col < Grid.cols; col++){
          Grid.map[row][col].value = backup[0].grid[row][col];
        }
      }      nextNumbers = backup[0].next;
      Bag = backup[0].bag;
      backup = []; //leave the last restart as safestate
      if(score > 48) {
        timesUndone++;
        justUndone = true;
      }
      firstUndo = false;
    }
    if(backup.length > 0) {
        undoCharges -= 3;
        // update grid values
        for(let row = 0; row < Grid.rows; row++){
          for(let col = 0; col < Grid.cols; col++){
            Grid.map[row][col].value = backup[backup.length-1].grid[row][col];
          }
        }
        nextNumbers = backup[backup.length-1].next;
        Bag = backup[backup.length-1].bag;
        if (backup.length > 1) backup.splice(backup.length-1); //leave the last restart as safestate
        if(score > 48) {
          timesUndone++;
          justUndone = true;
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
