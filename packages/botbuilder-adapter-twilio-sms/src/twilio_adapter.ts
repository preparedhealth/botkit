/**
 * @module botbuilder-adapter-twilio-sms
 */
/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { Activity, ActivityTypes, BotAdapter, TurnContext, ConversationReference, ResourceResponse } from 'botbuilder';
import * as Debug from 'debug';
import * as Twilio from 'twilio';
import { TwilioBotWorker } from './botworker';
const debug = Debug('botkit:twilio');
import * as AWS from 'aws-sdk';

/**
 * Connect [Botkit](https://www.npmjs.com/package/botkit) or [BotBuilder](https://www.npmjs.com/package/botbuilder) to Twilio's SMS service.
 */
export class TwilioAdapter extends BotAdapter {
    /**
     * Name used by Botkit plugin loader
     * @ignore
     */
    public name: string = 'Twilio SMS Adapter';

    /**
     * Object containing one or more Botkit middlewares to bind automatically.
     * @ignore
     */
    public middlewares;

    /**
     * A specialized BotWorker for Botkit that exposes Twilio specific extension methods.
     * @ignore
     */
    public botkit_worker = TwilioBotWorker;
    private pinpoint = new AWS.Pinpoint();
    private options: TwilioAdapterOptions;
    private api: Twilio.Twilio; // Twilio api

    /**
     * Create an adapter to handle incoming messages from Twilio's SMS service and translate them into a standard format for processing by your bot.
     *
     * Use with Botkit:
     *```javascript
     * const adapter = new TwilioAdapter({
     *      twilio_number: process.env.TWILIO_NUMBER,
     *      account_sid: process.env.TWILIO_ACCOUNT_SID,
     *      auth_token: process.env.TWILIO_AUTH_TOKEN,
     *      validation_url: process.env.TWILIO_VALIDATION_URL
     * });
     * const controller = new Botkit({
     *      adapter: adapter,
     *      // ... other configuration options
     * });
     * ```
     *
     * Use with BotBuilder:
     *```javascript
     * const adapter = new TwilioAdapter({
     *      twilio_number: process.env.TWILIO_NUMBER,
     *      account_sid: process.env.TWILIO_ACCOUNT_SID,
     *      auth_token: process.env.TWILIO_AUTH_TOKEN,
     *      validation_url: process.env.TWILIO_VALIDATION_URL
     * });
     * // set up restify...
     * const server = restify.createServer();
     * server.use(restify.plugins.bodyParser());
     * server.post('/api/messages', (req, res) => {
     *      adapter.processActivity(req, res, async(context) => {
     *          // do your bot logic here!
     *      });
     * });
     * ```
     *
     * @param options An object containing API credentials, a webhook verification token and other options
     */
    public constructor(options: TwilioAdapterOptions) {
        super();

        this.options = options;

        if (!options.twilio_number) {
            let err = 'twilio_number is a required part of the configuration.';
            if (!this.options.enable_incomplete) {
                throw new Error(err);
            } else {
                console.error(err);
            }
        }
        if (!options.account_sid) {
            let err = 'account_sid  is a required part of the configuration.';
            if (!this.options.enable_incomplete) {
                throw new Error(err);
            } else {
                console.error(err);
            }
        }
        if (!options.auth_token) {
            let err = 'auth_token is a required part of the configuration.';
            if (!this.options.enable_incomplete) {
                throw new Error(err);
            } else {
                console.error(err);
            }
        }

        if (this.options.enable_incomplete) {
            const warning = [
                ``,
                `****************************************************************************************`,
                `* WARNING: Your adapter may be running with an incomplete/unsafe configuration.        *`,
                `* - Ensure all required configuration options are present                              *`,
                `* - Disable the "enable_incomplete" option!                                            *`,
                `****************************************************************************************`,
                ``
            ];
            console.warn(warning.join('\n'));
            
        }

        try {
            this.api = Twilio(this.options.account_sid, this.options.auth_token);
        } catch (err) {
            if (err) {
                if (!this.options.enable_incomplete) {
                    throw new Error(err);
                } else {
                    console.error(err);
                }
            }
        }

        if (!options.pinpoint_number) {
            let err = 'pinpoint_number is a required part of the configuration.';
            if (!this.options.pinpoint_number) {
              throw new Error(err);
            } else {
              console.error(err);
            }
          }
          if (!options.aws_region) {
            let err = 'aws_region  is a required part of the configuration.';
            if (!this.options.aws_region) {
              throw new Error(err);
            } else {
              console.error(err);
            }
          }
          if (!options.pinpoint_appid) {
            let err = 'pinpoint_appid is a required part of the configuration.';
            if (!this.options.pinpoint_appid) {
              throw new Error(err);
            } else {
              console.error(err);
            }
          }
      
          try {
            AWS.config.update({
              region: process.env.Region
            });
          } catch (err) {
            console.error(err);
          }
      

        this.middlewares = {
            spawn: [
                async (bot, next): Promise<void> => {
                    bot.api = this.api;
                    next();
                }
            ]
        };
    }

    /**
     * Formats a BotBuilder activity into an outgoing Twilio SMS message.
     * @param activity A BotBuilder Activity object
     * @returns a Twilio message object with {body, from, to, mediaUrl}
     */
    private activityToTwilio(activity: Partial<Activity>): any {
        const message = {
            body: activity.text,
            from: this.options.twilio_number,
            to: activity.conversation.id,
            mediaUrl: undefined
        };

        if (activity.channelData && activity.channelData.mediaUrl) {
            message.mediaUrl = activity.channelData.mediaUrl;
        }

        return message;
    }

    /**
     * Standard BotBuilder adapter method to send a message from the bot to the messaging API.
     * [BotBuilder reference docs](https://docs.microsoft.com/en-us/javascript/api/botbuilder-core/botadapter?view=botbuilder-ts-latest#sendactivities).
     * @param context A TurnContext representing the current incoming message and environment. (Not used)
     * @param activities An array of outgoing activities to be sent back to the messaging API.
     */
    public async sendActivities(context: TurnContext, activities: Partial<Activity>[]): Promise<ResourceResponse[]> {
        const responses = [];
        for (var a = 0; a < activities.length; a++) {
            const activity = activities[a];
            if (activity.type === ActivityTypes.Message) {
                let msg = activity.text;
                const custPhone = activity.conversation.id;
                const messageId = await this.sendPinpointSms(custPhone, msg);
                // responses.push({ id: messageId });
                // const message = this.activityToTwilio(activity as Activity);
                // const res = await this.api.messages.create(message);
                responses.push({ id: res.sid });
            } else {
                debug('Unknown message type encountered in sendActivities: ', activity.type);
            }
        }

        return responses;
    }

    

    private async sendPinpointSms(custPhone, message) {
        console.log('sendPinpointSms:start');
        var paramsSMS = {
          ApplicationId: this.options.pinpoint_appid,
          MessageRequest: {
            Addresses: {
              [custPhone]: {
                ChannelType: 'SMS'
              }
            },
            MessageConfiguration: {
              SMSMessage: {
                Body: message,
                MessageType: 'TRANSACTIONAL',
                OriginationNumber: this.options.pinpoint_number
              }
            }
          }
        };
        return new Promise((resolve, reject) => {
            const pinpoint_number = this.options.pinpoint_number;
          this.pinpoint.sendMessages(paramsSMS, function(err, data) {
            if (err) {
              console.log('An error occurred.\n');
              console.log(err, err.stack);
              reject({ err, data });
            } else if (
              data['MessageResponse']['Result'][custPhone]['DeliveryStatus'] !=
              'SUCCESSFUL'
            ) {
              console.log('Failed to send SMS response:');
              console.log(data['MessageResponse']['Result']);
              reject({ data });
            } else {
              console.log(
                'Successfully sent response via SMS from ' +
                  pinpoint_number +
                  ' to ' +
                  custPhone
              );
              const messageId =
                data['MessageResponse']['Result'][custPhone]['MessageId'];
              resolve(messageId);
            }
          });
        });
      }

    /**
     * Twilio SMS adapter does not support updateActivity.
     * @ignore
     */
    // eslint-disable-next-line
     public async updateActivity(context: TurnContext, activity: Partial<Activity>): Promise<void> {
        debug('Twilio SMS does not support updating activities.');
    }

    /**
     * Twilio SMS adapter does not support deleteActivity.
     * @ignore
     */
    // eslint-disable-next-line
     public async deleteActivity(context: TurnContext, reference: Partial<ConversationReference>): Promise<void> {
        debug('Twilio SMS does not support deleting activities.');
    }

    /**
     * Standard BotBuilder adapter method for continuing an existing conversation based on a conversation reference.
     * [BotBuilder reference docs](https://docs.microsoft.com/en-us/javascript/api/botbuilder-core/botadapter?view=botbuilder-ts-latest#continueconversation)
     * @param reference A conversation reference to be applied to future messages.
     * @param logic A bot logic function that will perform continuing action in the form `async(context) => { ... }`
     */
    public async continueConversation(reference: Partial<ConversationReference>, logic: (context: TurnContext) => Promise<void>): Promise<void> {
        const request = TurnContext.applyConversationReference(
            { type: 'event', name: 'continueConversation' },
            reference,
            true
        );
        const context = new TurnContext(this, request);

        return this.runMiddleware(context, logic);
    }

    /**
     * Accept an incoming webhook request and convert it into a TurnContext which can be processed by the bot's logic.
     * @param req A request object from Restify or Express
     * @param res A response object from Restify or Express
     * @param logic A bot logic function in the form `async(context) => { ... }`
     */
    //@ts-ignore
    public async processActivity(req, res, logic: (context: TurnContext) => Promise<void>): Promise<void> {

        console.log({ 
            headers: req.headers, body : req.body}, 'incoming sns webhook:');
        console.log({ 
            Message: req.body}, 'incoming message content');

            /**
             * SNS RESPONSE 
            headers {
            'x-amz-sns-message-type': 'Notification',
            'x-amz-sns-message-id': '214b0132-74d2-54bb-8b87-57ca73fdc1be',
            'x-amz-sns-topic-arn': 'arn:aws:sns:us-east-1:305244661193:survey-sns-topic',
            'x-amz-sns-subscription-arn': 'arn:aws:sns:us-east-1:305244661193:survey-sns-topic:d42ec141-ef0b-499a-9c12-51e1161f42c8',
            'content-length': '1207',
            'content-type': 'application/json; charset=UTF-8',
            host: '5ab003ac.ngrok.io',
            'user-agent': 'Amazon Simple Notification Service Agent',
            'accept-encoding': 'gzip,deflate',
            'x-forwarded-for': '72.21.217.73'
            },
            body {
            Type: 'Notification',
            MessageId: '214b0132-74d2-54bb-8b87-57ca73fdc1be',
            TopicArn: 'arn:aws:sns:us-east-1:305244661193:survey-sns-topic',
            Message: '{"originationNumber":"+17732205399","destinationNumber":"+12058465294","messageKeyword":"keyword_305244661193","messageBody":"Yo yo yo","inboundMessageId":"1d1c7503-8f65-5be4-a148-23fb884a087a","previousPublishedMessageId":"4ekeknv7qtva0qg54p71m6ckt8gb806lt2mjfbg0"}',
            Timestamp: '2020-03-27T13:51:43.628Z',
            SignatureVersion: '1',
            Signature: 'V3H1BZSrPHUjCnUpJ02EZ+ZnxdyqxmwB3avY4Qj/olZAM8GEWbanNnMh6kdU0Jm05nd5l6RJIsurvo3+UGAXNgL7DtwPIPrYK2h/FKQJ2mjPCYO93A87TKdrDldY6/PgJl8bBvkZ0sgJG388QW4XsnHxiTlT2YiW+RMXxF49Mss5TVB8Afc2JsA8dwrBN+MXr0mpIO1idZ2D0jImSpEsGwdcm6PdgXgztIeqsTphaMzMd+MF/web0jjbSjgKSGOEPHR69r5LXNlqx1bFyRyOZvzCZguNlKAGfSLZIB8jWGrqqOOzppEcxq3FpCFvYCL50j/FCMGyyAMaPPVGRV+SXg==',
            SigningCertURL: 'https://sns.us-east-1.amazonaws.com/SimpleNotificationService-a86cb10b4e1f29c941702d737128f7b6.pem',
            UnsubscribeURL: 'https://sns.us-east-1.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:us-east-1:305244661193:survey-sns-topic:d42ec141-ef0b-499a-9c12-51e1161f42c8'
            }
            */





       // if (await this.verifySignature(req, res) === true) {
            const message : SNSMessage = (req.body? JSON.parse(req.body.Message): null) ;
            if ( message ){ 
                const activity = {
                    id: message.messageBody,
                    timestamp: new Date(),
                    channelId: 'twilio-sms',
                    conversation: {
                        id: message.originationNumber
                    },
                    from: {
                        id: message.originationNumber
                    },
                    recipient: {
                        id: message.destinationNumber
                    },
                    text: message.messageBody,
                    channelData: message,
                    type: ActivityTypes.Message
                };
    
                // // Detect attachments
                // if (message.NumMedia && parseInt(message.NumMedia) > 0) {
                //     // specify a different event type for Botkit
                //     activity.channelData.botkitEventType = 'picture_message';
                // }
    
                // create a conversation reference
                const context = new TurnContext(this, activity as Activity);
    
                context.turnState.set('httpStatus', 200);
    
                await this.runMiddleware(context, logic);
    
                // send http response back
                console.log('SENDING RESPONSE STATUS',context.turnState.get('httpStatus'));
                res.status(context.turnState.get('httpStatus'));
                if (context.turnState.get('httpBody')) {
                    console.log('SENDING RESPONSE BODY ' , context.turnState.get('httpBody'));
                    res.send(context.turnState.get('httpBody'));
                } else {
                    res.end();
                }
            }
        // }
    }

    /**
     * Validate that requests are coming from Twilio
     * @returns If signature is valid, returns true. Otherwise, sends a 400 error status via http response and then returns false.
     */
    private async verifySignature(req, res): Promise<any> {
        let twilioSignature;
        let validation_url;

        // Restify style
        if (!req.headers) {
            twilioSignature = req.header('x-twilio-signature');

            validation_url = this.options.validation_url ||
                (req.headers['x-forwarded-proto'] || (req.isSecure()) ? 'https' : 'http') + '://' + req.headers.host + req.url;
        } else {
        // express style
            twilioSignature = req.headers['x-twilio-signature'];

            validation_url = this.options.validation_url ||
                ((req.headers['x-forwarded-proto'] || req.protocol) + '://' + req.hostname + req.originalUrl);
        }

        if (twilioSignature && Twilio.validateRequest(this.options.auth_token, twilioSignature, validation_url, req.body)) {
            return true;
        } else {
            debug('Signature verification failed, Ignoring message');
            res.status(400);
            res.send({
                error: 'Invalid signature.'
            });
            return false;
        }
    }
}
export interface SNSMessage { 
    originationNumber : string; //from Survey Participant
    destinationNumber : string; //to Pinpoint
    messageKeyword : string; 
    messageBody: string // text content
    inboundMessageId: string;
    previousPublishedMessageId : string;  
}
/**
 * Parameters passed to the TwilioAdapter constructor.
 */
export interface TwilioAdapterOptions {
    /**
     * The phone number associated with this Twilio app, in the format 1XXXYYYZZZZ
     */
    twilio_number: string;
    /**
     * The account SID from the twilio account
     */
    account_sid: string;
    /**
     * An api auth token associated with the twilio account
     */
    auth_token: string;
    /**
     * An optional url to override the automatically generated url signature used to validate incoming requests -- [See Twilio docs about securing your endpoint.](https://www.twilio.com/docs/usage/security#validating-requests)
     */
    validation_url?: string;
    /**
     * Allow the adapter to startup without a complete configuration.
     * This is risky as it may result in a non-functioning or insecure adapter.
     * This should only be used when getting started.
     */
    enable_incomplete?: boolean;

    /**
   * The phone number associated with this Pinpoint app, in the format 1XXXYYYZZZZ
   */
  pinpoint_number: string;
  /**
   * The aws region
   */
  aws_region: string;
  /**
   * The pintpoint app id
   */
  pinpoint_appid: string;

}
