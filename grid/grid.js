function newCell(row,col) {
  let cell = {
    "value": Math.floor(Math.random()*3)+1,
    "selected": false,
    "color": 0,
    "row": row,
    "col": col,
    "preview": 0, // 0 means no preview
    isNeighborOf: function(row, col) {
      if( (col+1 == this.col || col-1 == this.col) && row == this.row ) {
        return true;
      } else if( (row+1 == this.row || row-1 == this.row) && col == this.col) {
        return true;
      } else {
        return false;
      }
    },
    select: function() {
      this.color = 1;
      this.selected = true;
    },
    deselect: function() {
      this.color = 0;
      this.selected = false;
      this.preview = 0;
    },
    newValue: function() {
      this.value = generateNext();
    }
  }
  return cell;
}

function createGrid(cols, rows) {
  let newGrid = {
    "cols": cols,
    "rows": rows,
    "map": [],
  }
  for(let row = 0; row < newGrid.rows; row++){
    let rowTemp = [];
    for(let col = 0; col < newGrid.cols; col++){
      rowTemp.push(newCell(row,col));
    }
    newGrid.map.push(rowTemp);
  }
  return newGrid;
}

// let Grid = createGrid(4,4);
