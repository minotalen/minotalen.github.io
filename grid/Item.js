let usedItems = [];

function createItem(init = "rand", charge = getRandomInt(3)+3) {
  let types = ["swap", "grow", "sum4", "shift", "col", "sum", "pick", "sum6", "turn", "sort",  "shrink"];
  // took out row
  let thisType;
  if (init == "rand") {
    thisType = types[getRandomInt(Math.min(types.length,level+3))];
    if(level>=5) thisType = types[getRandomInt(Math.min(types.length-2,level+1))+2];
  } else {
    thisType = types[init];
  }
  if(init == "shift") charge += 2;
  if(init == "pick" || init == "sum" || init == "sum6") charge -= 1;
  if(init == "shrink" || init == "sort") charge -= 2;
  charge = Math.max(charge, 1);
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
    items[item] = createItem(8);
    // items[item] = 0;
  }
  return items;
}

let Items = new Array(3);
Items = initItem(Items);

//// leveling up and item generation
//generate items
let level=0;
let levelNeed = [1,  1, 1, 2,  2,  3,  3,   4,   4,   5,    5,    5];
let levelVal =  [12,24,48,96,192,384,768,1536,3072,6144,12288,24576];

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
          usedItems.push(itemIcon(Items[0].type)+ " " + Items[0].charge);
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
    let randomChg = Math.max(1, levelNeed[level] + Math.floor(Math.random()*4) - 2);
    let itemChoice = createItem("rand", randomChg);
    selection.push(itemChoice);
    if(selection.length == 2){
      if(selection[0].type == selection[1].type){
        console.log("both items type " + selection[0].type + ". rerolling!");
        selection = [];
        i = -1;
      }
    }
 }
  // and a charge
  if(selection.length == 2){
    // if( (Items[0]==0 || Items[0].depleted) && (Items[1]==0 || Items[1].depleted) && (Items[2]==0 || Items[0].depleted) ) {
      let generatedChg = Math.max( Math.min( (levelNeed[level]+Math.floor(Math.random()*4)-2), 6) ,1);
      console.log(generatedChg);
      if (level>=2) selection.push(generatedChg)
    // }
  }
  return selection;
}
