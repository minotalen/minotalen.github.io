const correctArray = ["wenn", "ich", "nicht", "sehe", "dass", "ich", "blind", "bin", "dann", "bin", "ich", "blind", "wenn", "ich", "aber", "sehe", "dass", "ich", "blind", "bin", "dann", "sehe", "ich"];
let quoteIndex = 0;
const correctQuote =
    "wenn ich nicht sehe,\n \t\t\tdass ich blind bin,\n dann bin ich blind; \n\t\t\twenn ich aber sehe,\n dass ich blind bin, \n\t\t\t\tdann sehe ich.";
let lastWord = "";
let hintTimerRunning = false;
let hintTime;
let hintTimeAmount = 4000;
let solvedOnce = false;

function speak(elem) {
  let msg = new SpeechSynthesisUtterance();
  let synth = window.speechSynthesis;
  let voices = synth.getVoices();
  msg.text = elem.innerText;
  msg.lang = 'de-DE';
  msg.voice = voices[2];
  msg.volume = 1; // 0 to 1
  msg.rate = 1.1; // 0.1 to 10
  msg.pitch = 1; //0 to 2

  msg.start = function(e) {
    elem.classList.add("highlight");
  };
  msg.onend = function(e) {
    elem.classList.remove("highlight");
  };

  if(correctArray[quoteIndex-1] == elem.innerText && !solvedOnce) {
    return;
  }
  if(correctArray[quoteIndex] == elem.innerText) {
    // console.log()
    quoteIndex++;
    quote.innerText = truncate(correctQuote, quoteIndex);
  } else if(quoteIndex < 23) {
    hintTimeAmount = Math.max(hintTimeAmount - 50, 500);
    console.log(hintTimeAmount);
    if (correctArray[0] == elem.innerText) {
      quoteIndex = 1;
      quote.innerText = truncate(correctQuote, quoteIndex);
    } else {
      quoteIndex = 0;
      quote.innerText = "";
    }
  }

  if(quoteIndex == 1) speechSynthesis.cancel();
  speechSynthesis.speak(msg);
  lastWord = elem.innerText;

  if(hintTimerRunning) {
    hintTimerRunning = false;
    // console.log("clearing hint timer");
    clearTimeout(hintTime);
  }

  hintTime = setTimeout(hint, hintTimeAmount);
  hintTimerRunning = true;

  // finished quote
  if(quoteIndex == 23 && !solvedOnce) {
    source.innerHTML = `- <a href="https://minotalen.digital/projects/#schaltkreishaiku">heinz von förster</a>`;
    let quot = new SpeechSynthesisUtterance();

    quot.text = elem.innerText;
    quot.lang = 'de-DE';
    quot.voice = voices[2];
    quot.volume = 1; // 0 to 1
    quot.rate = 1.1; // 0.1 to 10
    quot.pitch = 1; //0 to 2
    quot.text = ". zitiert nach heinz von förster";
    speechSynthesis.speak(quot);
    solvedOnce = true;
    for(let i = 0; i < schaltWord.length; i++) {
      schaltWord[i].classList.add("blink_me");
      // schaltWord[i].addEventListener("click", function( event ) {
      //   if (parent)
      //     parent.document.location.href = "https://minotalen.github.io/portfolio/projects/#schaltkreishaiku";
      //   else
      //     location.href = "https://minotalen.github.io/portfolio/projects/#schaltkreishaiku";
      // });
    }
  }

}

// gives hint for next word after timer ran out
function hint() {
  console.log("giving hint");
  for(let i = 0; i < schaltWord.length; i++) {
    if(correctArray[quoteIndex] == schaltWord[i].innerText) {
      schaltWord[i].classList.add("blink_me");
    }
  }
  hintTimerRunning = false;
}

// event listeners
const schaltWord = document.getElementsByClassName("schaltWord");
for(let i = 0; i < schaltWord.length; i++) {
  schaltWord[i].addEventListener("mouseenter", function( event ) {
    // console.log("selected", schaltWord[i].innerText);
    // remove hint
    for(let j = 0; j < schaltWord.length; j++) {
      schaltWord[j].classList.remove("blink_me");
    }
    // prevent duplicate utterance
    if(lastWord != schaltWord[i].innerText || solvedOnce) {
      speak(schaltWord[i]);
    }
  });

}

function truncate(str, no_words) {
    return str.split(" ").splice(0,no_words).join(" ");
}

//show quote on success
const quote = document.getElementById("quoteshow");
const source = document.getElementById("source");

hint();

function preventBehavior(e) {
    e.preventDefault();
}
