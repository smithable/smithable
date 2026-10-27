# Where the pictures come from

A new app has pictures from the start: the sample records of the starters that show pictures each have one, and `smithable new` gives an app a picture for its landing page and a logo. They come from the Smithable image library, served at `https://docs.smithable.ai/images/`, with its list of every picture in `https://docs.smithable.ai/images/index.json`. This page says where the library's pictures come from, what you may do with them, and how an app marks the ones an AI made.

## Pictures made with an AI

Most pictures in the library were made for Smithable with an AI image model; the prompt for each is kept in the library's own repository ([smithable/smithable-images](https://github.com/smithable/smithable-images)); none is copied from another site. Smithable waives whatever rights it has in them under CC0 1.0: use them, change them, or sell an app that shows them, with nothing to credit. Like any CC0 work they come without a warranty.

An app marks these pictures with a small "AI-generated" or "AI" badge where they could pass for photographs. The badge is on unless you switch it off (`aiBadge: false` in `smithable.ux.yml`, or `smithable op setAiBadge false`). Rules on labelling pictures an AI made differ from place to place; whether your audience needs the badge is your responsibility.

## Real photographs

Some pictures are real photographs, released under CC0 or in the public domain, from Wikimedia Commons, where a file whose licence is in doubt can be flagged and deleted. The library takes a photograph only from there, and only when:

- its page marks it CC0 or public domain, read again from Commons when the picture is fetched, never trusted from an earlier search;
- its page carries no restriction notice (personality rights, trademarks, insignia).

It is cut to 3:2, made smaller, and saved without its metadata. A real photograph carries no badge. An app that uses a real photograph lists it, with its author and source, in `public/images/CREDITS.md`: a file for you, not linked from the app's pages (it is served like any file in `public/`). CC0 and public domain ask for no credit, but where a picture came from should be easy to find.

A product's brand can still show in a photograph (a laptop's, a bike's, a record player's); CC0 covers the photograph, not the brand.

## The photographs and their sources

The marketplace starter's twelve items are real photographs:

| Picture | Author | Licence | Source |
|---|---|---|---|
| An armchair | Bita RmJohnson Liuosa | CC0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:MC_%E6%BE%B3%E9%96%80_Macau_%E5%96%9C%E4%BE%86%E7%99%BB%E9%85%92%E5%BA%97_Sheraton_Grand_Macao_%E5%AE%A2%E6%88%BF_hotel_room_%E7%81%B0%E8%89%B2_%E6%A2%B3%E5%8C%96%E6%A4%85_armchair_sofa_n_%E5%95%A1%E8%89%B2%E6%9C%A8%E8%A3%BD%E8%8C%B6%E5%B9%BE_brown_wooden_tea_table_%E6%97%A9%E4%B8%8A_morning_November_2023_R12S_03.jpg) |
| A floor lamp | Mamcmi | CC0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Green_floor_lamp.png) |
| A table and chairs | Breather breather | CC0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Wooden_table_and_chairs_(Unsplash).jpg) |
| A city bike | deadrat | CC0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Bicycle_parked_near_a_seasonal_pond_at_Kumbakudi.jpg) |
| A road bike | Moklys | CC0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Triban_RC520_Decathlon_road_bike.jpg) |
| A laptop | www.Pixel.la Free Stock Photos | CC0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Apple-iphone-laptop-notebook_(24216913612).jpg) |
| Headphones | Alphacolor 13 duck58cth | CC0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Headphones_on_a_loudspeaker_(Unsplash).jpg) |
| A record player | Amitbalani | CC0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:HMV_Record_Player.jpg) |
| Old books | Ch. Maderthoner | CC0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Old_Books_01.JPG) |
| Rowing boats | Mustang Joe | CC0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Rowboats_at_the_Ch%C3%A2teau_de_Fontainebleau_(53747683385).jpg) |
| An acoustic guitar | Veradrive | CC0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Yamaha_Acoustic_Guitar_FG-331v2.jpg) |
| Wooden toys | LakshanaRamasamy | CC0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Wooden_toys_with_wheels.jpg) |

The library's `index.json` is the full list as it is now: each picture says `generated: true` or `false`, and a photograph has a `credit` with its page, author, licence and the day it was fetched.
