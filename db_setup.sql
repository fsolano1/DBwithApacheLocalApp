CREATE DATABASE IF NOT EXISTS db_sentimientos;
USE db_sentimientos;

CREATE TABLE IF NOT EXISTS tweets (
    id_tweet INT PRIMARY KEY,
    entity VARCHAR(100),
    sentiment_real VARCHAR(50),
    tweet_text TEXT,
    sentiment_prediction VARCHAR(50) DEFAULT NULL,
    confidence FLOAT DEFAULT NULL
);
