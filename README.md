#  Steam Trade Bot with Node.js
Node.js program that handle incomming trade offers from Steam plataform.

# Getting Started

This is an open-source project that tries to give you one example of a **Steam-Trading-Bot(TF2)**. It's a nice goal to getting started with programming-world.

# Prerequisites

> - Node.js
> - npm
> - JS Editor Program (Ex: Atom)

# Essentials

> - Steam Account available for trade
> - Shared Secret and Identity Secret Key: ([What is?](http://searchsecurity.techtarget.com/definition/shared-secret) | [How to get it? -iOS-](https://forums.backpack.tf/index.php?/topic/45995-guide-how-to-get-your-shared-secret-from-ios-device-steam-mobile/) | [How to get it? -Android-](https://forums.backpack.tf/index.php?/topic/46354-guide-how-to-find-the-steam-identity_secret-on-an-android-phone/))
> - Knowledge about JSON. [How a JSON works?](https://developer.mozilla.org/es/docs/Learn/JavaScript/Objects/JSON)

# Set Up Bot

### Edit config.js file.
### Edit DBPrices.json
    "Item name as it appears in inventory": {
    
    "craftable": "Craftable" or "Non-Craftable",
    
    "buy": price to buy in refs(13.11),
    
    "sell": price to sell in refs(13.22)
  	}




# Node.js Modules

>- [steam-user](https://www.npmjs.com/package/steam-user) | It lets you interface with Steam without running an actual Steam client.
>- [steam-totp](https://www.npmjs.com/package/steam-totp) | This lightweight module generates Steam-style 5-digit alphanumeric two-factor authentication codes given a shared secret.
>- [steamcommunity](https://www.npmjs.com/package/steamcommunity) | Easy interface for the Steam Community website. This module can be used to simply login to steamcommunity.com for use with other libraries, or to interact with steamcommunity.com.
>- [steam-tradeoffer-manager](https://www.npmjs.com/package/steam-tradeoffer-manager) | This module is designed to be a completely self-contained manager for Steam trade offers.
>- [tf2](https://www.npmjs.com/package/tf2) | This module provides a very flexible interface for interacting with the Team Fortress 2 Game Coordinator. It's designed to work with a node-steam SteamUser or node-steam-user SteamUser instance.
>- and more..

# What it really does? - Step by Step -

 0. **Pending about**: Steam Community notifications: Friend requests, new trade offers, any change in trade offer state. This is thanks to events listeners, base of node.js. You will need to know how they works: [Documentation](https://nodejs.org/api/events.html)
 1. **Login** into Steam and set TF2 as game played.
 2. **Load TF2's BP** and organize it by type.
 3. - new offer -
 4. **Parse new offer** and set the bot to a busy state. _(This prevents handle multiple offers at same time)_
 5. **Identify offe**r and declare it into an offerState:
 	- 'aceptable' : Offer will be accepted. It's a donation or it's from admin. 
    - 'deneganle' : Offer wil be declined. It's glitched, has trade hold or its an scam.
    - 'valida' : Offer will be processed and getting value of itemsToGive and itemsToReceive.
 6. If offerState = 'valida | **identify items**.
 7. Checking one by one if item is in our DBPrices or it is a currencie.
 8. Sum values of items and determine if offer will be **declined** or **accepted**.
 9. **Confirm** our action.
 10. set Bot to not-busy state.
 
 
 
 