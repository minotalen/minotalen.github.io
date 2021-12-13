audioLoop = new Audio('loop.mp3');
if (typeof audioLoop.loop == 'boolean')
{
    audioLoop.loop = true;
}
else
{
    myAudio.addEventListener('ended', function() {
        this.currentTime = 0;
        this.play();
    }, false);
}
audioLoop.play();
