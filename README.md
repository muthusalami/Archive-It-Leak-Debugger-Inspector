# Archive-It Leak Debugger & Inspector (ALDI) Google Chrome extension

ALDI is a Google Chrome extension that performs quality assurance on Internet Archive's Archive-It pages by providing the user insight on live leaks of an Archive-It site & the ability to compare console log messages between the Archive-It site & the 'live' site.

---

## set up

1. download or clone repo to local machine
2. import the extension to Google Chrome
   - navigate to 'extensions' and then to 'manage extensions'
   - toggle 'developer mode' on at the top right corner
   - click on 'load unpacked' at the top left corner
   - select and load the folder that contains the files. note that chrome will only accept folders one level up. you will get a 'could not load manifest' error if you do it two levels up.
   - pin the extension to the browser

---

## operation

<div align="center">
  <img src="/images/readme/ui.png" alt="leakcount"/>
</div>

1. navigate to an archive-it site in the browser. the extension will display the number of leaks as a badge & if any.

![leakurl](/images/readme/leakurl.png)

2. the user may investigate the leak URL by clicking on 'Display Leak Log' in the extension menu & selecting the appropriate tab using the drop down menu.

![leakurl](/images/readme/compare.png)

3. the user may also compare console log messages of the archive-it site with the 'live' site, if any, by clicking on 'Display Console Log' in the extension menu. the user will need to load the 'live' site in a separate tab before launching the 'Display Console Log' or by refreshing the 'Display Console Log' popup window with 'CTRL + R' or 'CMD + R'.

---

## thank you

alex dempsey & jefferson bailey
