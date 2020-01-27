function createMeta(metaR, metaC) {
  let newMeta = {
    "metaR": metaR,
    "metaC": metaC,
    "map": [],
    "fuel": 20
  }
  metaW = 16;
  metaH = 16;
  for(let row = 0; row < newMeta.metaR; row++){
    let rowTemp = [];
    for(let col = 0; col < newMeta.metaC; col++){
      rowTemp.push(newCell(row,col));
    }
    newMeta.map.push(rowTemp);
  }
  return newMeta;
}

function loadMeta(meta, rowStart, colStart, size) {
  let metaChunk = {
    "rows": size,
    "cols": size,
    "rowStart": rowStart,
    "colStart": colStart,
    "map": []
  }
  for(let i = 0; i < size; i++){
    let rowTemp = [];
    for(let j = 0; j < size; j++){
       rowTemp.push(meta.map[rowStart+i][colStart+j]);
       rowTemp[j].row = i;
       rowTemp[j].col = j;
       // console.log(rowStart+i, colStart+j);
    }
    metaChunk.map.push(rowTemp);
  }
  return metaChunk;
}

function saveMeta(meta, chunk) {
  let updatedMeta = meta;
  for(let i = 0; i < chunk.rows; i++){
    for(let j = 0; j < chunk.cols; j++){
       updatedMeta.map[chunk.rowStart+i][chunk.colStart+j] = chunk.map[i][j];
       // console.log("saving" + chunk.rowStart+i, chunk.colStart+j);
    }
  }
  return updatedMeta;
}

function shrinkMeta(meta, rowStart, colStart, size) {
  let highestNum = 0;
  let highestRow = 0;
  let highestCol = 0;
  let hi2Num = 0;
  let hi2NumRow = 0;
  let hi2NumCol = 0;
  // console.log(meta.metaR, rowStart+size, meta.metaC, colStart+size);
  if(meta.metaR > rowStart+size && meta.metaC > colStart+size) {
    for(let i = 0; i <= size; i++){
      // let rowTemp = [];
      for(let j = 0; j <= size; j++){
         if(meta.map[rowStart+i][colStart+j].value>highestNum){
           hi2Num = highestNum;
           hi2NumRow = highestRow;
           hi2NumCol = highestCol;
           highestNum = meta.map[rowStart+i][colStart+j].value;
           highestRow = rowStart+i;
           highestCol = colStart+j;
         }
      }
    }
    if(meta.map[hi2NumRow][hi2NumCol].value > 3) {
      console.log("2ndHi: shrinking " + meta.map[hi2NumRow][hi2NumCol].value + " becomes " +  Math.max( 1, Math.floor(meta.map[hi2NumRow][hi2NumCol].value/2 +.5) ));
      meta.fuel += Math.max( 1, Math.floor(meta.map[hi2NumRow][hi2NumCol].value/2 +.5) );
      meta.map[hi2NumRow][hi2NumCol].value = Math.max( 1, Math.floor(meta.map[hi2NumRow][hi2NumCol].value/2 +.5) );
    } else {
      console.log("highest: shrinking " + meta.map[highestRow][highestCol].value + " becomes " +  Math.floor(meta.map[highestRow][highestCol].value/2 +.5));
      meta.fuel += Math.max( 1, Math.floor(meta.map[highestRow][highestCol].value/2 +.5) );
      meta.map[highestRow][highestCol].value = Math.max( 1, Math.floor(meta.map[highestRow][highestCol].value/2 +.5) );

    }
  }
  return meta;
}
// on restart
// saveMeta(metaMap, Grid);
let metaMap = createMeta(15, 15);
let Grid = loadMeta(metaMap, 0, 0, 4);
