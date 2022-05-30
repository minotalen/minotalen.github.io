var rad = document.querySelector(".rad"),
	video = document.querySelector(".vid"),
	x = document.querySelector("#x"),
	y = document.querySelector("#y")

window.onload = function() {
	console.log("sane");
    x.addEventListener('onchange', function () {
       rad.innerHtml = x.value; 
       console.log(x.value)
    });
    video.addEventListener('click', function (e) {
       console.log("hi");

    });
}
