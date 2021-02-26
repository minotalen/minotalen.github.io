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
    $(".searchInput").focus();
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
    console.log("search change", searchValue);

    $(".tier").removeClass("searchResult");
    let priceList = $(this).text().trim().split(" ")
    // console.log( index + ": " + $( this ).text().trim(), searchValue, priceList);
    let searchZero = " " + searchValue.toLowerCase() + " ";
    // let searchBless = " " + Math.floor(searchValue.toLowerCase()*1.1+0.5) + " ";
    let searchCurse = " " + Math.floor(searchValue.toLowerCase()/1.1+0.5) + " ";
    // let searchCurse = " " + Math.floor(searchValue.toLowerCase()*0.8+0.5) + " ";
    let searchBlessed = " " + Math.floor(searchValue.toLowerCase()/0.8+0.5) + " ";
    console.log("search", searchValue, searchBlessed, $(".blessed").hasClass('toggled'), searchCurse, $(".cursed").hasClass('toggled'));

    $(".tier").children().each( function( index ) {
      $(this).removeClass("searchResult");
      if(!$(this).hasClass("itemname")) $(this).removeClass("priceHighlight");

      if(searchValue != "") {
        // item name filter
        if($(this).hasClass("itemname") && $(this).text().toLowerCase().indexOf(searchValue.toLowerCase()) != -1) {
          console.log( index + ": " + $( this ).text(), $(this).attr('class').split('/\s+/') );
          $(this).addClass("searchResult");
        }

        // item price filter
        const regularSearch = $(this).text().indexOf(searchZero) != -1;
        const blessedSearch = $(this).text().indexOf(searchBlessed) != -1;
        const cursedSearch = $(this).text().indexOf(searchCurse) != -1
        const buyAndSell = ( $(this).hasClass("buy") || $(this).hasClass("buy1") || $(this).hasClass("buy2") || $(this).hasClass("sell") || $(this).hasClass("sell1") || $(this).hasClass("sell2") );

        if( buyAndSell && ( regularSearch || ($(".blessed").hasClass('toggled') && blessedSearch) || ($(".cursed").hasClass('toggled') && cursedSearch) ) ) {
          $(this).addClass("priceHighlight");
          $(this).parent().addClass("searchResult");
        }
      } else {

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
      elements[i].onclick = itemToggle;
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
                    362,
                    378,
                    393,
                    409,
                    420,
                    425,
                    441,
                    462,
                    483,
                    500,
                    504,
                    525,
                    546,
                    551,
                    567,
                    577,
                    600,
                    603,
                    630,
                    656,
                    660,
                    682,
                    690,
                    708,
                    720,
                    750,
                    780,
                    800,
                    810,
                    900,
                    945,
                    990,
                   1000,
                   1035,
                   1080,
                   1125,
                   1170,
                   1200,
                   1215,
                   1260,
                   1320,
                   1380,
                   1440,
                   1500,
                   1560,
                   1575,
                   1620,
                   1650,
                   1725,
                   1800,
                   1875,
                   1950,
                   2000,
                   2025,
                   5000,
                  10000,
                  30000]

autocomplete(document.getElementById("autocomplete"), prices);
