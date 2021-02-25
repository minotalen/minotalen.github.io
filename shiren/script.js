function itemToggle() {
  if (!$(this).hasClass('toggled')) {
      $(this).addClass("toggled");
  } else {
      $(this).removeClass("toggled");
  }
}

function toggleCat(catName){
  if (!$(this).hasClass('toggled')) {
      console.log("adding toggled to", $(this));
      $(this).addClass("toggled");
  } else {
      $(this).removeClass("toggled");
  }
  if ($('div.itemtype.'+catName).css('display') != 'none') {
    $('div.itemtype.'+catName).hide();
  } else {
    $('div.itemtype.'+catName).show();
  }
}

function giveToggle(){
   var elements = document.getElementsByClassName('itemname');
   for(var i = 0; i < elements.length; i++){
      elements[i].onclick = itemToggle;
   }
}

function filter(className) {
  console.log("starting filter: ", className)
  // go through items, check if they have the class
  $( ".itemname" ).each(function( index ) {
    if(   $( this ).hasClass(className) || $( this ).hasClass("desc") || className == "all") {
      $( this ).show();
    } else {
      $( this ).hide();
    }
  });
  // clear empty tiers
  $( ".tier" ).each(function( index ) {
    let hasActive = false;
    $( this ).each(function( index ) {
      $( this ).children(".itemname").each(function( index ) {
        if($(this).css('display') != 'none') {
          hasActive = true;
          console.log( index + ": " + $( this ).text() );
        }
      });
    });
    if(!hasActive) $( this ).hide()
    else $( this ).show();
  });
}

giveToggle();
