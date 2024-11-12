# Archive-It Leak Debugger & Inspector (ALDI)

**ALDI** is a Google Chrome extension that performs quality assurance on Internet Archive's Archive-It replay pages by 1) detecting + rewriting CSP violations 2) providing the user insight on live leaks of a replay site & 3) allowing the user to compare console log messages between the replay & the 'live' site.

## set up

1. download or clone repo
2. import the extension to Google Chrome
   - navigate to 'extensions' and then to 'manage extensions'
   - toggle on 'developer mode' at the top right corner
   - click on 'load unpacked' at the top left corner
   - select and load the folder that contains the files. **note** chrome will only accept folders one level up. you will get a 'could not load manifest' error if you do it two levels up.
   - pin the extension to the browser

## operation

<div align="center">
  <img src="/images/readme/ui_2.png" alt="leakcount"/>
</div>

3. navigate to an archive-it replay site in the browser. the extension will display the number of CSP violations and/or leaks as a badge, if any.

![leakurl](/images/readme/cspviolations.png)
![leakurl](/images/readme/leakurl.png)

4. the user may investigate the CSP violations and/or leaks by clicking on 'CSP Violations' or 'Leak Log' in the extension menu & selecting the desired tab in the drop down menu.

<div align="center">
  <img src="/images/readme/csp_switch.png" alt="toggle"/>
</div>

5. the extension also allows the user to rewrite the CSP violations by toggling on the 'REWRITE CSP' switch.

![leakurl](/images/readme/compare.png)

6. the user may also compare console log messages of the replay site with the 'live' site, if any, by clicking on 'Display Console Log' in the extension menu. the user will need to load the 'live' site in a separate tab before launching the 'Display Console Log'.

## thank you

alex dempsey & jefferson bailey
