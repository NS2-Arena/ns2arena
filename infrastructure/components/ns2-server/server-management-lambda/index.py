import os
import boto3


def handler(event, context):
    # requestType = event["requestType"]
    tableName = os.getenv("ServerTableName")

    print(tableName)
