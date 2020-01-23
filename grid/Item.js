function createItem(init = "rand", charge = getRandomInt(3)+3) {
  let types = ["row", "col", "swap", "grow", "shift", "pick", "sum", "sum6", "sort"];
  //shuffle
  let thisType;
  if (init == "rand") {
    thisType = types[getRandomInt(types.length)];
  } else {
    thisType = types[init];
  }
  if(init == "pick" || init == "sum" || init == "sum6") charge -= 1;
  let newItem = {
    "charge": charge,
    "type": thisType,
    "depleted": false
  }
  //make random type
  return newItem;
}

let itemMode = 0;
function useItem(item) {
  if(!item.depleted) {
    itemMode = item.type;
    if(item.charge > 0) {
      item.charge--;
    } else {
      item.depleted = true;
    }
  } else {
    console.log("Item depleted");
  }
  return item;
}

function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}

function initItem(items) {
  for(item = 0 ; item < items.length; item++) {
    // items[item] = createItem(8);
    items[item] = 0;
  }
  return items;
}

let Items = new Array(3);
Items = initItem(Items);

//// leveling up and item generation
//generate items
let level=0;
let levelNeed = [1,  1, 1, 2,  2,  3,  3,   4,   4,   5];
let levelVal = [12,24,48,96,192,384,768,1536,3072,6144];

let selection = 0;
let lastComboVal = 0;
// call during combine
function isLeveled(value) {
  lastComboVal = value;
  if(value >= levelVal[level]) {
    selection = loadSelection(level);
    if (selection.length == 1) {
      for(itm in Items) {
        if(Items[itm]==0) {
          Items[itm] = selection[0];
          selection = 0;
          break;
        }
        if (Items[itm].hasOwnProperty == "depleted") {
          if(!Items[itm].depleted) {
            Items[itm] = selection[0];
            selection = 0;
            break;
          }
        }
      }
      // if all three slots are full convert to charges
      if (selection != 0) {
        let randItem = Math.floor(Math.random(selection.length));
        Items[randItem].charge += selection[0].charge-1;
      }
      console.log(Items);
      level++;
      isLeveled(value);
    } else {
      gameState = "level";
    }
  }
}

//make a charge item
function loadSelection(level) {
  //level 1&2 have 1/2 choices, afterwards give 3
  if (level <= 1) choiceAmt = level+1;
  else choiceAmt = 2;
  let selection = [];
  //for loop makes 2 items
  for(let i= 0; i<choiceAmt; i++) {
    let randomChg = levelNeed[level] + Math.floor(Math.random()*3);
    let itemChoice = createItem("rand", randomChg);
    selection.push(itemChoice);
    console.log(i);
    if(selection.length == 2){
      if(selection[0].type == selection[1].type){
        console.log("both items type " + selection[0].type + ". rerolling!");
        selection = [];
        i = -1;
      }
    }
 }
  // and a charge
  let generatedChg = levelNeed[level]+Math.max(Math.floor(Math.random()*2)-1,1);
  if (level>=2) selection.push(generatedChg)
  return selection;
}
