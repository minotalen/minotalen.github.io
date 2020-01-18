function createItem(init = "rand", charge = getRandomInt(3)+3) {
  let types = ["row", "col", "swap", "grow", "shift"];
  // shift, clone1234
  let thisType;
  if (init == "rand") {
    thisType = types[getRandomInt(types.length)];
  } else {
    thisType = types[init];
  }
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
    items[item] = createItem();
  }
  return items;
}
let Items = new Array(3);
Items = initItem(Items);
