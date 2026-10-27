# Getting started

There are two ways to start, and an app made on smithable.ai can come down to your own machine.

## On smithable.ai

Nothing to install. Pick an example or describe your app, and it opens in your browser with its editor beside it. A sandbox is free for two hours and needs no sign-up. With an invite to the private beta you keep your apps, publish them on your own domain and hand them to a developer or a client.

**[Getting started on smithable.ai](start-hosted.md)**

## On your own machine

Free and open source, with no account. You need Node 24: install the command line from npm, make an app from a starter and open it in Studio, the visual editor. You can deploy it with Docker wherever you like.

**[Getting started on your own machine](start-local.md)**

## The same either way

The app is described by the same files (`smithable.yml` and its companions, see the [spec reference](../spec/v0.1.md)). It is changed by the same [operations](operations.md), each one undoable, and it is generated as an ordinary TanStack Start app that depends on nothing from Smithable. An app made on smithable.ai downloads with its code, history and data, ready to carry on with on your own machine (with an invite: a two-hour sandbox cannot be downloaded).
