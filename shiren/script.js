// code for dark mode toggle
const toggleSwitch = document.querySelector('.theme-switch input[type="checkbox"]');
const currentTheme = localStorage.getItem('theme') ? localStorage.getItem('theme') : null;
let css = document.styleSheets[0].cssRules[0].style;

function switchTheme() {
  let toggle = $('#checkbox')[0];
  if (toggle.checked) {
      console.log(toggle);
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
  } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
  }
}
if (currentTheme) {
    document.documentElement.setAttribute('data-theme', currentTheme);
    if (currentTheme === 'light') {
        toggleSwitch.checked = true;
    }
}
toggleSwitch.addEventListener('change', switchTheme, false);
$('.theme-switch-wrapper').mousedown(function( event ) {
  event.preventDefault();
});

// #########################################################################################################

$(".searchInput").on("change paste keyup", function( e ) {
  if( e.keyCode != 40 && e.keyCode != 38) updateSearch($(".searchInput").val());
});

$(".priceToggle").click(function() {
  if (!$(this).hasClass('toggled')) {
      // show prices
      $(".container").addClass("containerPrice");
      $(".container").removeClass("containerNoPrice");
      $(".itemname").css("grid-column", "");

      $(".buy").show();
      $(".buy1").show();
      $(".buy2").show();
      $(".sell").show();
      $(".sell1").show();
      $(".sell2").show();
      $('.descriptor').show("");

      $(this).addClass("toggled");
  } else {
      // hide prices
      $(".container").removeClass("containerPrice");
      $(".container").addClass("containerNoPrice");
        $(".itemname").css("grid-column", "1/span 5");

      $(".buy").hide();
      $(".buy1").hide();
      $(".buy2").hide();
      $(".sell").hide();
      $(".sell1").hide();
      $(".sell2").hide();
      $('.descriptor').hide("");

      $(this).removeClass("toggled");
  }
});
$(".priceToggle").click();

$(".blessCurse").click(function() {
    if (!$(this).hasClass('toggled')) {
        $(this).addClass("toggled");
    } else {
        $(this).removeClass("toggled");
    }
    updateSearch($(".searchInput").val(), true);
});

$(".menu").click(function() {
  $(".searchInput").focus();
});

$(window).keypress(function (e) {
  if (e.key === ' ' || e.key === 'Spacebar') {
    e.preventDefault();
    // $(".searchInput").val('');
    $(".searchInput").focus();
    $(".searchInput").select();

  }
})

$(".clear").click(function() {
  console.log("clearing");
  $(".searchInput").val('');
  updateSearch($(".searchInput").val(), true);
});

let lastValue = "";


function updateSearch(searchValue, force) {
  if(searchValue != lastValue  || force) {
    lastValue = searchValue;

    $(".tier").removeClass("searchResult");
    $(".tier").children().removeClass("searchResult");
    $(".tier").removeClass("priceBlessed");
    $(".tier").removeClass("priceCursed");
    let priceList = $(this).text().trim().split(" ")
    // console.log( index + ": " + $( this ).text().trim(), searchValue, priceList);
    let searchZero = " " + searchValue.toLowerCase() + " ";
    let searchCurse = " " + Math.floor(searchValue.toLowerCase()*1.1+0.5) + " ";
    let searchUnCurse = " " + Math.floor(searchValue.toLowerCase()/0.8+0.5) + " ";
    let searchBlessed = " " + Math.floor(searchValue.toLowerCase()*0.8+0.5) + " ";
    let searchUnBlessed = " " + Math.floor(searchValue.toLowerCase()/1.1+0.5) + " ";

    if($(".cursed").hasClass('toggled') && searchUnBlessed != " NaN ") {
      $('.cursed span').text(searchUnBlessed);
    } else {
      $('.cursed span').text("");
    }
    if($(".blessed").hasClass('toggled') && searchUnCurse != " NaN ") {
      $('.blessed span').text(searchUnCurse);
    } else {
      $('.blessed span').text("");
    }

    console.log("search", searchValue, searchBlessed, searchUnBlessed, $(".blessed").hasClass('toggled'), searchCurse, searchUnCurse, $(".cursed").hasClass('toggled'));

    $(".tier").children().each( function( index ) {

      if(!$(this).hasClass("itemname")) $(this).removeClass("priceHighlight");

      if(searchValue != "") {
        $(".help").hide()
        // item name filter
        if($(this).hasClass("itemname") && $(this).text().toLowerCase().indexOf(searchValue.toLowerCase()) != -1) {
          console.log( index + ": " + $( this ).text(), $(this).attr('class').split('/\s+/') );
          $(this).addClass("searchResult");
        }

        const regularSearch = $(this).text().indexOf(searchZero) != -1;
        const blessedSearch = $(this).text().indexOf(searchBlessed) != -1;;
        const unBlessedSearch = $(this).text().indexOf(searchUnBlessed) != -1;
        const cursedSearch = $(this).text().indexOf(searchCurse) != -1
        const unCursedSearch = $(this).text().indexOf(searchUnCurse) != -1
        const buyAndSell = ( $(this).is('.buy, .buy2, .sell, .sell2') );
        const buyAndSellBC = ( $(this).is('.buy, .buy2, .sell, .sell2') );
        // item price filter


        if( buyAndSell && regularSearch ) {
          $(this).addClass("priceHighlight");
          $(this).parent().removeClass("priceBlessed");
          $(this).parent().removeClass("priceCursed");
          $(this).parent().addClass("searchResult");
        }
        if( buyAndSellBC && ($(".blessed").hasClass('toggled') && unBlessedSearch) ) {
          $(this).addClass("priceHighlight");
          $(this).parent().addClass("priceBlessed");
          $(this).parent().removeClass("searchResult");
        }
        if( buyAndSellBC && ($(".cursed").hasClass('toggled') && unCursedSearch) ) {
          $(this).addClass("priceHighlight");
          if($(this).hasClass("buy2")) {

          }
          $(this).parent().addClass("priceBlessed");
          $(this).parent().addClass("priceCursed");
          $(this).parent().removeClass("searchResult");
        }
      } else {
        $(".help").show()
      }
    });
  }
}

function itemToggle() {
  if (!$(this).hasClass('toggled')) {
      $(this).addClass("toggled");
  } else {
      $(this).removeClass("toggled");
  }
}

function toggleCat(catName){
  console.log($('button.'+catName).hasClass('toggled'));
  if ($('button.'+catName).hasClass('toggled')) {
    $('button.'+catName).removeClass("toggled");
  } else {
    console.log("adding toggled to", $(this));
    $('button.'+catName).addClass("toggled");
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
      if(!elements[i].classList.contains('desc')) elements[i].onclick = itemToggle;
   }
}

function filter(className) {
  console.log("starting filter: ", className)
  console.log($('button.dungeon.'+className).hasClass('toggled'));

  $('button.dungeon').removeClass("toggled");
  $('button.dungeon.'+className).addClass("toggled");

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
          // console.log( index + ": " + $( this ).text() );
        }
      });
    });
    if(!hasActive) $( this ).hide()
    else $( this ).show();
  });
}

giveToggle();


//  ########################### Autocomplete ########################################

function autocomplete(inp, arr) {
  /*the autocomplete function takes two arguments,
  the text field element and an array of possible autocompleted values:*/
  var currentFocus;
  /*execute a function when someone writes in the text field:*/
  inp.addEventListener("input", function(e) {
      var a, b, i, val = this.value;
      /*close any already open lists of autocompleted values*/
      closeAllLists();
      if (!val) { return false;}
      currentFocus = -1;

      a = document.createElement("DIV");
      a.setAttribute("id", this.id + " autocomplete-list");
      a.setAttribute("class", "autocomplete-items");
      this.parentNode.appendChild(a);
      for (i = 0; i < arr.length; i++) {
        /*check if the item starts with the same letters as the text field value:*/
        if (arr[i].toString().substr(0, val.length).toUpperCase() == val.toUpperCase()) {
          /*create a DIV element for each matching element:*/
          b = document.createElement("DIV");
          /*make the matching letters bold:*/
          b.innerHTML = "<strong>" + arr[i].toString().substr(0, val.length) + "</strong>";
          b.innerHTML += arr[i].toString().substr(val.length);
          /*insert a input field that will hold the current array item's value:*/
          b.innerHTML += "<input type='hidden' value='" + arr[i] + "'>";
          /*execute a function when someone clicks on the item value (DIV element):*/
              b.addEventListener("click", function(e) {
              /*insert the value for the autocomplete text field:*/
              inp.value = this.getElementsByTagName("input")[0].value;
              updateSearch(inp.value);
              /*close the list of autocompleted values,
              (or any other open lists of autocompleted values:*/
              closeAllLists();
          });
          a.appendChild(b);
        }
      }
  });
  /*execute a function presses a key on the keyboard:*/
  inp.addEventListener("keydown", function(e) {
      var x = document.getElementById(this.id + " autocomplete-list");
      if (x) x = x.getElementsByTagName("div");
      if (e.keyCode == 40) {
        /*If the arrow DOWN key is pressed,
        increase the currentFocus variable:*/
        currentFocus++;
        /*and and make the current item more visible:*/
        addActive(x);
      } else if (e.keyCode == 38) { //up
        /*If the arrow UP key is pressed,
        decrease the currentFocus variable:*/
        currentFocus--;
        /*and and make the current item more visible:*/
        addActive(x);
      } else if (e.keyCode == 13) {
        /*If the ENTER key is pressed, prevent the form from being submitted,*/
        e.preventDefault();
        if (currentFocus > -1) {
          /*and simulate a click on the "active" item:*/
          if (x) {
            // console.log($(".autocomplete-active").find("input").val());
            updateSearch($(".autocomplete-active").find("input").val());
            x[currentFocus].click();
          }
        }
      }
  });
  function addActive(x) {
    /*a function to classify an item as "active":*/
    if (!x) return false;
    /*start by removing the "active" class on all items:*/
    removeActive(x);
    if (currentFocus >= x.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = (x.length - 1);
    /*add class "autocomplete-active":*/
    x[currentFocus].classList.add("autocomplete-active");
    console.log($(".autocomplete-active").find("input").val());
    if (currentFocus > -1) updateSearch($(".autocomplete-active").find("input").val());
  }
  function removeActive(x) {
    /*a function to remove the "active" class from all autocomplete items:*/
    for (var i = 0; i < x.length; i++) {
      x[i].classList.remove("autocomplete-active");
    }
  }
  function closeAllLists(elmnt) {
    /*close all autocomplete lists in the document,
    except the one passed as an argument:*/
    var x = document.getElementsByClassName("autocomplete-items");
    for (var i = 0; i < x.length; i++) {
      if (elmnt != x[i] && elmnt != inp) {
      x[i].parentNode.removeChild(x[i]);
    }
  }
}
/*execute a function when someone clicks in the document:*/
document.addEventListener("click", function (e) {
    closeAllLists(e.target);
});
}

const prices = [      3,
                     10,
                     50,
                    100,
                    200,
                    210,
                    220,
                    231,
                    241,
                    252,
                    262,
                    273,
                    283,
                    300,
                    315,
                    330,
                    346,
                    350,
                    362,
                    367,
                    378,
                    385,
                    393,
                    402,
                    409,
                    420,
                    425,
                    437,
                    441,
                    462,
                    483,
                    500,
                    504,
                    525,
                    546,
                    551,
                    560,
                    567,
                    577,
                    588,
                    600,
                    603,
                    616,
                    630,
                    644,
                    656,
                    660,
                    661,
                    672,
                    682,
                    690,
                    693,
                    700,
                    708,
                    720,
                    724,
                    735,
                    750,
                    756,
                    770,
                    787,
                    780,
                    800,
                    805,
                    810,
                    819,
                    840,
                    850,
                    875,
                    900,
                    918,
                    945,
                    962,
                    990,
                   1000,
                   1006,
                   1035,
                   1050,
                   1080,
                   1093,
                   1100,
                   1125,
                   1150,
                   1170,
                   1200,
                   1215,
                   1225,
                   1250,
                   1260,
                   1286,
                   1320,
                   1347,
                   1380,
                   1408,
                   1440,
                   1470,
                   1500,
                   1531,
                   1560,
                   1575,
                   1600,
                   1620,
                   1650,
                   1680,
                   1725,
                   1760,
                   1800,
                   1840,
                   1875,
                   1890,
                   1920,
                   1950,
                   1980,
                   2000,
                   2025,
                   2070,
                   2100,
                   2160,
                   2200,
                   2205,
                   2250,
                   2300,
                   2310,
                   2340,
                   2400,
                   2415,
                   2430,
                   2500,
                   2520,
                   2625,
                   2750,
                   2875,
                   3000,
                   3125,
                   3500,
                   3675,
                   3850,
                   4025,
                   4200,
                   4375,
                   5000,
                   6000,
                   6300,
                   6600,
                   6900,
                   7200,
                   7500,
                  10000,
                  10500,
                  11000,
                  11500,
                  12000,
                  12500,
                  30000]

autocomplete(document.getElementById("autocomplete"), prices);
